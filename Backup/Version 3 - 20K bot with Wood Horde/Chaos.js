const signalR = require("@microsoft/signalr");
const token = process.env["REGISTRATION_TOKEN"] ?? createGuid();

let url = process.env["RUNNER_IPV4"] ?? "http://localhost";
url = url.startsWith("http://") ? url : "http://" + url;
url += ":5000/runnerhub";

let w, b, bi, p; //World Vars
var i,j,k //generic loops
var ds;

let r; //Round (Maybe Redundent)
let m; //Moves
var mx, my, ma, mp, ms, mct; //x,y,available,population, scout, tier

var en=[];

const connection = new signalR.HubConnectionBuilder().withUrl(url).configureLogging(signalR.LogLevel.Information).build();

async function start () {
    try {
        await connection.start();
        console.assert(connection.state === signalR.HubConnectionState.Connected);
        console.log("Connected to Runner");
        await connection.invoke("Register", token, "Chaos");
    } catch (err) {
        console.assert(connection.state === signalR.HubConnectionState.Disconnected);
        onDisconnect();
    }
};

connection.on("Disconnect", (id) => onDisconnect());

connection.on("Registered", (id) => {
    console.log("Registered with the runner");
});

//Scout Variables
var s=[];//ScoutTower Nodes
var fn=[];//Food Nodes
var wn=[];//Wood Nodes
var sn=[];//Stone Nodes
var sc=0;//Scout Towers (Own)

var l;//Temp Array Lenght
var tn;//Temp Nodes

var nt;

var mf, mw, mo, mh; //Food, Wood, Stone, heat
var nf, nw, ns, nh; //Need Food, Wood, Stone, Heat
var wf, ww, ws, wh; //Worker food, wood, stone, heat	

var lv=0.16; //Livetime value of a unit
			 //Calculated 10 Rounds = 3 / 5 wood + 1 food. meaning each unit has an upkeep of 0,16 resources per round.
			 //Every Base gives a certain amount of res per round calculated at gamestart. 
			 //This means the moment a unit upkeep is less than what the closest base with abundence is its no longer profitable to upkeep units.
			 //At this stage I can stop campfires completely and use the units I have left to stockpile.
			 //Since an end unit gives 25 points, keeping units alive for 160 rounds will give less points than upkeep. 
			 //It also means that after Round 160 a unit alive is worth more than a unit dead. So might want to restart campfires after Round 160 to allow growth and maximize points as long as we have food it should be great.
			 //That last spike in population can really mess my opponents around, 
			 //Considered leaving this out for Round 1, but I really want that Golden Ticket. And getting the mining sequence the same as mine will be a nightmare if theres added updates. (Especially if my "available units" game is perfect.)

var gFac=1.5; //Growth Factor, setting a growth leighway. 1,5 worked rather well. 
			  //Growth felt somewhat hindered

var kill=false; //Kill when food becomes unsustainible
//Dont farm while kill = true (so nodes can refill more)
	//Wastes less population on harvesting dead points
	//set minimum sustaining population (maybe 500) -> want to try and get population back to 20 000 for endgame. (for 500 000 points)

var sct=0;//Scout

//generate store 30 rounds worth of res farming in array (4 for heat)
var fa=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
	wa=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
	sa=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	ha=[0,0,0,0];

connection.on("ReceiveBotState", gameState => {
   	w=gameState.world;
	b=gameState.bots;
	p=gameState.populationTiers;
	
	r=w.currentTick;
	
	console.log("Tick: "+r);
	if(r==1){
		//Set up initial data
		bi=gameState.botId;
		for(i = b.length-1; i>=0; i--){
			if(b[i].id==bi){
				mx=b[i].baseLocation.x;my=b[i].baseLocation.y;
			} else {
				en.push(["ENEMY"]);
			}
		}
		
		for(i = 0; i<w.map.scoutTowers.length; i++){
			  tn=w.map.scoutTowers[i];
			  s.push([tn.id,tn.position.x,tn.position.y,bR(d(tn.position.x,tn.position.y,mx,my))]);
		 	}
		s.sort(function(a,b){return a[3]-b[3]});
		}
	
	m={"playerId" : bi,"actions" : []} 
	
	for(i = b.length-1; i>=0; i--){
			
			if(b[i].id==bi){
				ma=b[i].availableUnits;
				ms=b[i].scoutingUnits;
				mp=b[i].population;
				mf=b[i].food;
				mw=b[i].wood;
				mo=b[i].stone;
				mh=b[i].heat;
				msc=b[i].map.scoutTowers.length;
				mct=b[i].currentTierLevel;
				
				if(sc<msc){
				   console.log("Found Extra Nodes - Proceed to update pool");
					
					fn=[];sn=[];wn=[];
					
					for(k=s.length-1;k>=0;k--){
						tn=b[i].map.scoutTowers;
						for(j=msc-1;j>=0;j--){
							if(s[k][0]==tn[j]){
								s.splice(k, 1);
								console.log("Already Scounted Tower - Attempting to remove.");
							}
						}
					}
					
					for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						ds=bR(d(tn.position.x,tn.position.y,mx,my))+tn.workTime;
						if(tn.type==1){
							wn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tn.currentUnits]);
						} else if(tn.type==2){
							fn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tn.currentUnits]);
						} else {
							sn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tn.currentUnits]);
						}
					}

					sc=msc;
					wn.sort(function(a,b){return b[6]-a[6]});
					fn.sort(function(a,b){return b[6]-a[6]});
					sn.sort(function(a,b){return b[6]-a[6]});
				}
				
			}
	}
	
	//Added a 2 round current unit buf to every node...
		//It should replace the 30 Round buffer
		//To do, analize closest food node and see if current units gets taken off emmediately or after they leave. 
	
		//Closest Food node, Current Units is immediate
			//Food gets removed after they return. 
			//No need to cahce resources in this case, simplify everything. 
			//Leave in campfire for 2 round
			//Adjust other bases according to currentunits, and maxunits also real time. 
	
	for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						if(tn.type==1){
							for(j=wn.length-1;j>=0;j--){if(wn[j][0]==tn.id){wn[j][3]=tn.maxUnits;wn[j][5]=tn.amount-(tn.currentUnits*tn.reward);wn[j][8]=tn.currentUnits;}}
						} else if(tn.type==2){
							for(j=fn.length-1;j>=0;j--){if(fn[j][0]==tn.id){fn[j][3]=tn.maxUnits;fn[j][5]=tn.amount-(tn.currentUnits*tn.reward);fn[j][8]=tn.currentUnits;}}
						} else {
							for(j=sn.length-1;j>=0;j--){if(sn[j][0]==tn.id){sn[j][3]=tn.maxUnits;sn[j][5]=tn.amount-(tn.currentUnits*tn.reward);sn[j][8]=tn.currentUnits;}}
						}
					}
	
	//Need to keep my res food node functionality as it was for the sake of readjusting my own needs. 
		//Sadly
	
	if(fn.length>0){console.log("Closest Food Node Assess: "+JSON.stringify(fn[0]));}
	
	fa.shift();fa.push(0);
	wa.shift();wa.push(0);
	sa.shift();sa.push(0);
	ha.shift();ha.push(0);
	 
	//Lf last round population larger than this rounds population, kill all. (tracking bases must still be better)
	//When farming, Add a resource cache and ignore closest res according to cache + 10% (for food) (Reason 10% will account for the farming)
	
	if(kill){console.log("Unsustainible population - turn off campfires completely (no more heat)");}
	
	if(ma>0){
		
		console.log("My Population:"+mp+" Avail:"+ma);
		
		calcNeeds();
		
		//Handle Upkeep / Just dont die
		nf=nf+mp;
		nh=nh+mp;
		//nw=nw+Math.floor(mp*0.5)+1;
		nw=nw+1;
		if(mct>0){ns=ns+1;}//Ignore stone for tierre 1
		//ns=ns+Math.floor(mp*0.1)+1;
		if(nh>0){nw=nw+(Math.ceil(nh/5)*3);}
		
		console.log("Needs after upkeep calc - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		wf=0; ww=0; wh=0; ws=0;
		farm();
		cut();
		burn();
		
		console.log("Needs after upkeep Actions - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		
		//First Growth / Things are going well, lets multiply
		if(ma>0){
			
		nf=nf+Math.ceil(mp*gFac/1.2);
		nh=nh+Math.ceil(mp*gFac/0.9);
		if(nh>0){nw=nw+(Math.ceil(nh/5)*3);}
		console.log("Needs after Max Growth calc - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		wf=0; ww=0; wh=0; ws=0;
		cut();
		farm();
		burn();
		
		console.log("Needs after Max Growth Actions - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		if(nw>0){cut();}
		}
		
		//Lets explore
		if(s.length>0){scout();}
		
		//All good, Will need to advance soon
		if(ma>0){
			//Handle Next Tier Advancement, Do not advance to last Tier
			
			mct=mct+1;
			if(mct>5){mct=5;}
			console.log("Population:"+JSON.stringify(p[mct]));
				
			nf=nf+p[mct].tierResourceConstraints.food;
			nw=nw+p[mct].tierResourceConstraints.wood;
			ns=ns+p[mct].tierResourceConstraints.stone;
			
			console.log("Needs after Advancement calc - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
			
			mine();
			cut();
			farm();
			
			console.log("Needs after Advancement Actions - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		}
		
		//When 1 generation is no monger enough...
		if(ma>0){
			
		nf=nf+Math.ceil(mp*gFac/1.2);
		nh=nh+Math.ceil(mp*gFac/0.9);
		if(nh>0){nw=nw+(Math.ceil(nh/5)*3);}
		console.log("Needs after Max Growth calc - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		wf=0; ww=0; wh=0; ws=0;
		cut();
		farm();
		burn();
		
		console.log("Needs after Max Growth Actions - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		if(nw>0){cut();}
		}
		
		//What, still going? lets just hurt the trees 
		nw=nw+100000; 
		if(nw>0){cut();}
		
		console.log("Have Units Left After:"+ma+" - Use them");
		}
	
	sct--;
	
	console.log("Resources: W("+mw+") F("+mf+") S("+mo+") H("+mh+") ");
	
	if(m!=""){
		console.log("Send Action", m);
		connection.invoke("SendPlayerCommand", m);
		}
	
});

connection.on("ReceiveGameComplete", (winningBot) => {
    onDisconnect();
});

// Start the connection.
start();

function createGuid () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function onDisconnect () {
    console.log("Disconnected");
	console.log("Important Game Data");
    connection.stop();
}

//Calc Dist
function d(sx,sy,ex,ey) {return Math.sqrt((sx-ex)**2+(sy-ey)**2);}

//Round To even
function bR(td){
    var tr = Math.round(td);
    return (((((td>0)?td:(-td))%1)===0.5)?((0===(tr%2))?tr:(tr-1)):tr);
};

function calcNeeds(){
			nf=mf*-1;
			nh=mh*-1;
			ns=mo*-1;
			nw=mw*-1;
			for(i=0;i<3;i++){nh=nh-ha[i];nw=nw-wa[i];}
			console.log("Needs after Travel Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		}

function farm(){
	for(i = 0; i<fn.length; i++){if(nf<1||kill){break;}	
		if(fn[i][5]>nf){wf=Math.ceil(nf/fn[i][4]);}
		else {wf=Math.ceil(fn[i][5]/fn[i][4]);}
		if(ma<wf){wf=ma;}
		if(fn[i][3]<wf){wf=fn[i][3];}					 
		if(wf>0){m.actions.push({"type" : 3,"units" : wf,"id" : fn[i][0]});ma=ma-wf;
							fa[fn[i][7]]=fa[fn[i][7]]+(wf*fn[i][4]);
				 			fn[i][5]=fn[i][5]-(wf*fn[i][4]);
							nf=nf-(wf*fn[i][4]);
							
				if(fn[i][6]<lv){
					kill=true;}
				}
		
	}
}

function cut(){
	for(i = 0; i<wn.length; i++){if(nw<1){break;}
		if(wn[i][5]>nw){ww=Math.ceil(nw/wn[i][4]);}
		else {ww=Math.ceil(wn[i][5]/wn[i][4]);}
		if(ma<ww){ww=ma;}
		if(wn[i][3]<ww){ww=wn[i][3];}
		if(ww>0){m.actions.push({"type" : 4,"units" : ww,"id" : wn[i][0]});ma=ma-ww;
							wa[wn[i][7]]=wa[wn[i][7]]+(ww*wn[i][4]);
				 			wn[i][5]=wn[i][5]-(ww*wn[i][4]);
							nw=nw-(ww*wn[i][4]);
							}
		
	}
}

function mine(){
	for(i = 0; i<sn.length; i++){if(ns<1){break;}
		if(sn[i][5]>ns){ws=Math.ceil(ns/sn[i][4]);}
		else {ws=Math.ceil(sn[i][5]/sn[i][4]);}
		if(ma<ws){ws=ma;}
		if(sn[i][3]<ws){ws=sn[i][3];}
		if(ws>0){m.actions.push({"type" : 2,"units" : ws,"id" : sn[i][0]});ma=ma-ws;
							sa[sn[i][7]]=sa[sn[i][7]]+(ws*sn[i][4]);
				 			sn[i][5]=sn[i][5]-(ws*sn[i][4]);
							ns=ns-(ws*sn[i][4]);
							}
		
	}
}

function burn(){
	if(nh>0&&mw>=3&&ma>0&&!kill){
		wh=Math.ceil(nh/5);
		if(wh*3>mw){wh=Math.floor(mw/3);}
		if(ma<wh){wh=ma;}
		m.actions.push({"type" : 5,"units" : wh,"id" : "00000000-0000-0000-0000-000000000000"});
		ma=ma-wh;
		ha[2]=ha[2]+(wh*5);
		wa[2]=wa[2]-(wh*3);
		nh=nh-ha[3];
		nw=nw+(wh*3);
	}
}



function scout() {
	if(ms==0&&sct<1){
				for(i = 0; i<s.length; i++){if(ma==0||i>1){break;}m.actions.push({"type" : 1,"units" : 1,"id" : s[i][0]});ma--;sct=s[i][3];}
		} 
}
