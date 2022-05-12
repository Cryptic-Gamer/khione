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
var mx, my, ma, mp, ms, mct, mrn=0; //x,y,available,population, scout, tier, resnodes

var en=[];
var heatreq=14000000;

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
var tf, tw, ts; //total res harvested to rebalance the max storage
var woodsup;
var starve=false;

var lv=0.16; //Livetime value of a unit (Absolutely no usecase in V1.5 but could be essential later on.)

var sct=0;//Scout

//Cycles (Upkeep happens every 10 ticks, so all that matters is that I have an X amount of res dropping in every cycle. )
	//Tracking Cycles also helps harvest as much res as possible from distant nodes to ease my own nodes. 
	//Will do closest nodes for upkeep, growth and storage
	//Will do furthest node for cycle preparations
	//Aim to get the res between cycle 0.2 and 0.8 to avoid engine delays getting messy As early as possible so that the units are ready to go to the next cycle...

var cf=[0,0,0,0,0,0,0],cw=[0,0,0,0,0,0,0],cs=[0,0,0,0,0,0,0];
var cycle=0, ncycle;
var minr,maxr;


connection.on("ReceiveBotState", gameState => {
   	
	w=gameState.world;
	b=gameState.bots;
	p=gameState.populationTiers;
	
	r=w.currentTick;
	cycle=Math.floor(r/10);
	if(r%10==0){
		cs.shift();cs.push(0);
		cf.shift();cf.push(0);
		cw.shift();cw.push(0);
	}
	
	console.log("Cycle Cariables: food"+JSON.stringify(cf)+" wood"+JSON.stringify(cw)+" stone"+JSON.stringify(cs));
	
	console.log("Tick: "+r);
	console.log("Cycle: "+cycle);
	
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
	
	console.log("Scout Towers Complete:"+JSON.stringify(s));
	
	
	m={"playerId" : bi,"actions" : []} 
	
	for(i = b.length-1; i>=0; i--){
			
			if(b[i].id==bi){
				ma=b[i].availableUnits;
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
					sc=msc;
				}
				
				
				if(mrn<w.map.nodes.length){	
					console.log("Adding Nodes");
					
					fn=[];sn=[];wn=[];
					for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						ds=bR(d(tn.position.x,tn.position.y,mx,my))+tn.workTime;
						if(tn.type==1){
							wn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tn.currentUnits]);
						} else if(tn.type==2){
							fn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tn.currentUnits]);
						} else {
							sn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tn.currentUnits]);
						}
					}

					mrn=w.map.nodes.length;
					wn.sort(function(a,b){return b[6]-a[6]});
					fn.sort(function(a,b){return b[6]-a[6]});
					sn.sort(function(a,b){return b[6]-a[6]});
				}
				
			}
	}
	
	if(wn.length>0){
	   woodsup=0;
	   }
	
	console.log("Resource Nodes available:"+mrn);
	for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						if(tn.type==1){
							for(j=wn.length-1;j>=0;j--){if(wn[j][0]==tn.id){wn[j][3]=tn.maxUnits-tn.currentUnits;wn[j][5]=tn.amount-(tn.currentUnits*tn.reward);wn[j][8]=tn.currentUnits;}}
							woodsup=woodsup+tn.amount;
						} else if(tn.type==2){
							for(j=fn.length-1;j>=0;j--){if(fn[j][0]==tn.id){fn[j][3]=tn.maxUnits-tn.currentUnits;fn[j][5]=tn.amount-(tn.currentUnits*tn.reward);fn[j][8]=tn.currentUnits;}}
						} else {
							for(j=sn.length-1;j>=0;j--){if(sn[j][0]==tn.id){sn[j][3]=tn.maxUnits-tn.currentUnits;sn[j][5]=tn.amount-(tn.currentUnits*tn.reward);sn[j][8]=tn.currentUnits;}}
						}
					}
	
	
	//In a 4V4, I start getting starved for Heat, 
		//Set a variable, if total wood supply < 50 000
		//No More wood
		//At this time set kill = true
		//Calculate how much rounds my remaining Wood + Heat can sustain
		//if my remaining res can sustain growth till the end. set kill = false
	if(woodsup<50000){
		console.log("Starve = True");
		starve=true;
		i=cycle;
		j=mp;
		nh=mh+(Math.floor(mw/3*5));
		for(i=cycle;i<250;i++){
			console.log("Cycle: "+i+" Population:"+j+" Heat Left:"+nh);
			nh=nh-j;
			if(nh<0){break;}
			j=Math.ceil(j*1.05);
			if(i==248){starve=false;console.log("Starve = False");}
		}
		
	}
	
	minr=0;maxr=2500;
	
	if(ma>0){
		
		console.log("My Population:"+mp+" Avail:"+ma);
		
		calcNeeds();
		
		//Handle Upkeep / Just dont die
		nf=nf+mp;
		tf=tf+mp;
		nh=nh+mp;
		
		//nw=nw+Math.floor(mp*0.5)+1;
		nw=nw+1;
		tw=tw+1;
		//if(mct>0){ns=ns+1;}//Ignore stone for tierre 1
		//ns=ns+Math.floor(mp*0.1)+1;
		if(nh>0){nw=nw+(Math.ceil(nh/5)*3);
				tw=tw+(Math.ceil(nh/5)*3);
				}
		
		//console.log("Needs after upkeep calc - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns+", Constraints - Food: "+tf+", Wood: "+tw+", Stone: "+ts);
		
		wf=0; ww=0; wh=0; ws=0;
		farm();
		burn();
		cut();
		//console.log("Needs after upkeep Actions - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns+", Constraints - Food: "+tf+", Wood: "+tw+", Stone: "+ts);
		
		//Handle population growth res *2 (Prioritize Growth, enough time for rest later)
		if(ma>0){
		
			for(j=0;j<3;j++){
				nf=nf+Math.ceil(mp/1.2);
				nh=nh+Math.ceil(mp/0.9);
				tf=tf+Math.ceil(mp/1.2);
				
				if(nh>0){nw=nw+(Math.ceil(nh/5)*3);
						tw=tw+(Math.ceil(nh/5)*3);
						}
				
				wf=0; ww=0; wh=0; ws=0;
				cut();
				farm();
				burn();
				cut();

			}
		}
		
		//Lets explore
		if(s.length>0){scout();}
		
		if(ma>0){
			
		nw=nw+p[mct].tierMaxResources.wood-tw;
		ns=ns+p[mct].tierMaxResources.stone-ts;
		nf=nf+p[mct].tierMaxResources.food-tf;	
			
		//console.log("Needs after Max Storage calc - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns+", Constraints - Food: "+tf+", Wood: "+tw+", Stone: "+ts);
		wf=0; ww=0; wh=0; ws=0;
		
		mine();
		cut();
		farm();
		
		}
		
		if(ma>0&&heatreq>0){
		   nh=Math.ceil(mw-p[mct+1].tierResourceConstraints.wood*3); 
		   if(nh>0){nw=nw+(Math.ceil(nh/5)*3);}	
			
			wf=0; ww=0; wh=0; ws=0;
			
		   burn();
		   cut();
		   }
		
		//If still have units left, seek advancement cycle
			//Calculate next 6 ticks *5%
			//If population > advancement, allow farming
			//Write slowly, 
		for(i=1;i<=7;i++){
			mp=Math.ceil(mp*1.05);
			if(mp>=p[mct].maxPopulation){console.log("Will Advance in "+i+" cycles");
										console.log("Will Advance in "+i+" cycles");
										 console.log("Will Advance in "+i+" cycles");
										 console.log("Will Advance in "+i+" cycles");
										 console.log("Will Advance in "+i+" cycles");
										 
										 minr=(cycle+i)*10+2;
										 console.log("New Minr:"+minr);
										 
										 nw=nw+p[mct+1].tierMaxResources.wood-tw;
										 ns=ns+p[mct+1].tierMaxResources.stone-ts;
										 nf=nf+p[mct+1].tierMaxResources.food-tf;
										 
										 console.log("Need Wood:"+nw+" Need Stone:"+ns+" Need Food:"+nf);
										 
										 wf=0; ww=0; wh=0; ws=0;
										 
										 mine();
										 cut();
										 farm();
										 
										 break;
										}
			}
		
		
		if(ma>0){
			console.log("Have Units Left After:"+ma+" - Use them");
			}	
		}
	
	console.log("Heat Requirements: "+heatreq);
	
	
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
			nf=(mf*-1)-cf[0]-cf[1]-cf[2]-cf[3]-cf[4]-cf[5]-cf[6];
			nh=(mh*-1);
			ns=(mo*-1)-cs[0]-cs[1]-cs[2]-cs[3]-cs[4]-cs[5]-cs[6];
			nw=(mw*-1)-cw[0]-cw[1]-cw[2]-cw[3]-cw[4]-cw[5]-cw[6];
			
			ts=0;tf=0;tw=0;
	
			console.log("Needs after Travel Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		}

function farm(){
	for(i = 0; i<fn.length; i++){if(nf<1){break;}
		if(r+fn[i][7]<minr||r+fn[i][7]>maxr){continue;}
		if(fn[i][3]==0||fn[i][5]==0){continue;}
		if(fn[i][5]>nf){wf=Math.ceil(nf/fn[i][4]);}
		else {wf=Math.ceil(fn[i][5]/fn[i][4]);}					 
		if(ma<wf){wf=ma;}
		if(fn[i][3]<wf){wf=fn[i][3];}					 
		if(wf>0){m.actions.push({"type" : 3,"units" : wf,"id" : fn[i][0]});ma=ma-wf;
							fn[i][5]=fn[i][5]-(wf*fn[i][4]);
							nf=nf-(wf*fn[i][4]);
				 			fn[i][3]=fn[i][3]-wf;
				 			
				 			ncycle=Math.floor((r+fn[i][7])/10)-cycle;
				 			cf[ncycle]=cf[ncycle]+(wf*fn[i][4]);
				}
	}
}


function cut(){
	for(i = 0; i<wn.length; i++){if(nw<1){break;}
		if(r+wn[i][7]<minr||r+wn[i][7]>maxr){continue;}
		if(wn[i][3]==0||wn[i][5]==0){continue;}
		if(wn[i][5]>nw){ww=Math.ceil(nw/wn[i][4]);}
		else {ww=Math.ceil(wn[i][5]/wn[i][4]);}
		if(ma<ww){ww=ma;}
		if(wn[i][3]<ww){ww=wn[i][3];}
		if(ww>0){m.actions.push({"type" : 4,"units" : ww,"id" : wn[i][0]});ma=ma-ww;
				 			wn[i][5]=wn[i][5]-(ww*wn[i][4]);
							nw=nw-(ww*wn[i][4]);
				 			wn[i][3]=wn[i][3]-ww;
				 
				 			ncycle=Math.floor((r+wn[i][7])/10)-cycle;
				 			cw[ncycle]=cw[ncycle]+(ww*wn[i][4]);
							}
		
	}
}

function mine(){
	for(i = 0; i<sn.length; i++){if(ns<1){break;}
		if(r+sn[i][7]<minr||r+sn[i][7]>maxr){continue;}
		if(sn[i][3]==0||sn[i][5]==0){continue;}
		if(sn[i][5]>ns){ws=Math.ceil(ns/sn[i][4]);}
		else {ws=Math.ceil(sn[i][5]/sn[i][4]);}
		if(ma<ws){ws=ma;}
		if(sn[i][3]<ws){ws=sn[i][3];}					 
		if(ws>0){m.actions.push({"type" : 2,"units" : ws,"id" : sn[i][0]});ma=ma-ws;
				 			sn[i][5]=sn[i][5]-(ws*sn[i][4]);
							ns=ns-(ws*sn[i][4]);
				 			sn[i][3]=sn[i][3]-ws;
				 
				 			ncycle=Math.floor((r+sn[i][7])/10)-cycle;
				 			cs[ncycle]=cs[ncycle]+(ws*sn[i][4]);
				 
							}
		
	}
}

function burn(){
	if(nh>0&&mw>=3&&ma>0&&r<2490&&heatreq>0&&!starve){
		wh=Math.ceil(nh/5);
		if(wh*3>mw){wh=Math.floor(mw/3);}
		if(ma<wh){wh=ma;}
		m.actions.push({"type" : 5,"units" : wh,"id" : "00000000-0000-0000-0000-000000000000"});
		ma=ma-wh;
		nh=nh-(wh*5);
		heatreq=heatreq-(wh*5);
		//Remember to account for Wood in here, 
	}
}

//split upkeep array from Max Res Array
	//Track both seperatelyso that one Array can be for upkeep and the other for Maxres farming.
	//Also allow upkeep to farm Population advances ahead of time. So that my units can drop res back into my base the same tick I advanced (I will leave a population tolerence in here. ). 

function scout() {
	if(sct<1){
				for(i = 0; i<s.length; i++){if(ma==0||i>1){break;}m.actions.push({"type" : 1,"units" : 1,"id" : s[i][0]});ma--;sct=s[i][3];}
		} 
}

//Early game harvest some stone from enemy nodes. 
	//Ignore last unreachable levelup... in endneeds... 

//Handling Max Storage... 

//Readjust, Find Max growth so i can use extra units to work on tiere advancements and stockpiles
