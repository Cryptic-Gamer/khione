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
var mx, my, ma, mp, ms; //x,y,available,population, scout

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

var sct=0;//Scout

//Traveling Units Object 
	//When a move is made push in units, travel time * 2 + worktime and amount
		//Food
		//Wood
		//Stone
		//Scout

//generate store 30 rounds worth of res farming in array
var fa=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
	wa=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
	sa=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	ha=[0,0,0,0];

//Whenever a move is made, assign future food.
//Shift every round







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
							wn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100,ds]);
						} else if(tn.type==2){
							fn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100,ds]);
						} else {
							sn.push([tn.id,tn.position.x,tn.position.y,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100,ds]);
						}
					}

					sc=msc;
					wn.sort(function(a,b){return b[6]-a[6]});
					fn.sort(function(a,b){return b[6]-a[6]});
					sn.sort(function(a,b){return b[6]-a[6]});

					console.log("Food Set"+JSON.stringify(fn));
					console.log("Wood Set"+JSON.stringify(wn));
					console.log("Stone Set"+JSON.stringify(sn));

				}
				
			}
	}
	
	fa.shift();fa.push(0);
	wa.shift();wa.push(0);
	sa.shift();sa.push(0);
	ha.shift();ha.push(0);
	
	console.log("Wood Array"+JSON.stringify(wa));
	
	//Looks Good but seems like I am rescouting often. 
		//Likely scouting units is set under traveling Units. 
		//Or the engine has a 1 round delay. 
		//maybe after Round 5 do not allow scouting within 5 rounds of eachother. 
	
	//Calculate Every Node
			//Reward / (Distance + worktime) (How efficient harvesting would be on this tile)
			//Allowed = MaxUnits - currentUnits
	
	//Sorting will be an issue here. 
		//Will need to do a find all nodes loop here. 
	   
	if(ma>0){
		
		//Calculate all needs food(nf), wood(nw), heat(nh), stone(ns)
			//Build variables to track what I will need first as the game progresses
			//Set moves only at the end
		
		//Calculate needs while ma>0
			//Build units needed for every step
			//Track farming units?? Would be useful to not doubleup on res I dont need yet (Maybe not for the first event though)...
			//Late game it could be 100 units holding advancement back because I overstockpiled.
		
		//calculate food needs
		//calculate wood needs
		//calculate heat needs
		
		//check closest resource node
		//if supply is larger than need, divide res by reward and ceil and send population
		//else skip (will handle the alternate later on)
		
		console.log("My Population:"+mp+" Avail:"+ma);
		
		calcNeeds();
		
		//Handle Upkeep
		nf=nf+mp;
		nh=nh+mp;
		//nw=nw+Math.floor(mp*0.5)+1;
		nw=nw+1;
		//ns=ns+Math.floor(mp*0.1)+1;
		if(nh>0){nw=nw+Math.ceil(nh/5*3);}
		
		console.log("Needs after upkeep 1 - Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		
		wf=0; ww=0; wh=0; ws=0;
		farm();
		cut();
		burn();
		
		//If we can sustain, ready for next advance
			//Split the requirements evenly so that it maximizes population Growth
		
		//Calculate max population needs:
			
		
		/*
		populationTier = 100;

         heatSurplus = (bot.Heat - GetHeatConsumption(bot)) * engineConfig.ResourceImportance.Heat;
         foodSurplus = (bot.Food - GetFoodConsumption(bot)) * engineConfig.ResourceImportance.Food;

            var minResourceSurplus = (double) Math.Min(heatSurplus, foodSurplus);

            var populationRangeMin = bot.Population * -0.5;
            var populationRangeMax = bot.Population * 0.5;
            var populationChangeMin = populationTier.PopulationChangeFactorRange[0];
            var populationChangeMax = populationTier.PopulationChangeFactorRange[1];
            Logger.LogInfo("Calculation Service", $"Min Resource surplus {minResourceSurplus}");

            minResourceSurplus.NeverLessThan(populationRangeMin).NeverMoreThan(populationRangeMax);

            var populationChangeFactor =
                (minResourceSurplus - populationRangeMin) * (populationChangeMax - populationChangeMin) /
                (populationRangeMax - populationRangeMin) + populationChangeMin;
            
            var populationChange = Math.Ceiling(bot.Population * populationChangeFactor);
		
		*/
		
		
		
		//Can Survive
			//Calculate new needs
			//Set Max growth
		
		
		
		if(ma>0){
			//Handle Advance 1
		   }
		
		if(ma>0){
		   //Handle Scout
		   }
		
		if(ma>0){
		   //Handle Advance 2 Requirements
		   }
		
		if(ma>0){
		   //Handle Tiere Advancement
		   }
		
		if(ma>0){
		   //Endgame - Starve Stone (or Wood), As wood is tied to heat and can kill population fast if a user does not have any.
		   
		   }
		
		//Handle Food
			//Better approach, loop through Node Array, and actively look if a node still has resources before going to the next one. 
			//Loop in a way that allows continue and break incase a node is empty or finishes the task. But allow sending units to 2 nodes if one still has res. 
			//For Food, try and set a minimum so that you dont waste time on lots. 	
		
		scout();
		
		//Block Double Scout
		
		console.log("Have Units Left After:"+ma+" - Use them");
		sct--;
	   }
	
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
			nf=(mf*-1);
			nh=(mh*-1);
			ns=mo*-1;
			nw=mw*-1;
			
			console.log("Needs Before travel Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
			for(i=0;i<30;i++){nf=nf-fa[i];ns=ns-sa[i];nw=nw-wa[i];}
			for(i=0;i<4;i++){nh=nh-ha[i];}
			console.log("Needs after Travel Food:"+nf+", Wood:"+nw+", Heat:"+nh+", Stone: "+ns);
		}

function farm(){		
		for(i = 0; i<fn.length; i++){
				if(fn[i][5]>nf&&nf>0){
					wf=Math.ceil(nf/fn[i][4]);
					if(ma<wf){wf=ma;}
					if(ma>0){m.actions.push({"type" : 3,"units" : wf,"id" : fn[i][0]});ma=ma-wf;nf=0;
							fa[fn[i][7]]=fa[fn[i][7]]+(wf*fn[i][4]);
							}
				}
			}
	}

function cut(){
			for(i = 0; i<wn.length; i++){
				if(wn[i][5]>nw&&nw>0){
					ww=Math.ceil(nw/wn[i][4]);
					if(ma<ww){ww=ma;}
					if(ma>0){m.actions.push({"type" : 4,"units" : ww,"id" : wn[i][0]});ma=ma-ww;nw=0;
							wa[wn[i][7]]=wa[wn[i][7]]+(ww*wn[i][4]);
							}
				}
			}
}

//To Confirm:
	//Each Unit contributes 1 Wood
	//Each piece generates 5 heat

function burn(){
	if(nh>0&&mw>=3&&ma>0){
		wh=Math.ceil(nh/5);
		if(wh*3>mw){wh=Math.floor(mw/3);}
		if(ma<wh){wh=ma;}
		m.actions.push({"type" : 5,"units" : wh,"id" : "00000000-0000-0000-0000-000000000000"});
		ma=ma-wh;nh=0;
		ha[3]=ha[3]+(wh*5);
	}
}

function scout() {
	if(ms==0&&sct<1){
				for(i = 0; i<s.length; i++){if(ma==0){break;}m.actions.push({"type" : 1,"units" : 1,"id" : s[i][0]});ma--;sct=s[i][3];}
		} 
}
