const signalR = require("@microsoft/signalr");
const token = process.env["REGISTRATION_TOKEN"] ?? createGuid();

let url = process.env["RUNNER_IPV4"] ?? "http://localhost";
url = url.startsWith("http://") ? url : "http://" + url;
url += ":5000/runnerhub";

let w, a, b, bi, p; //World Vars
var i,j,k //generic loops
var ds;

let r; //Round (Maybe Redundent)
let m; //Moves
var mx, my, ma, mp, ms, mct, act, mrn=0, mid; //x,y,available,population, scout, tier, resnodes

var en=[];
var heatreq=14500000;//Make sure this works

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
var gd=[];//Gold Nodes
var mt=[];//Territory Nodes
var sc=0;//Scout Towers (Own)

var l;//Temp Array Lenght
var tn;//Temp Nodes

var nt;

var mf, mw, mo, mh, mg; //Food, Wood, Stone, heat
var nf, nw, ns, nh, ng; //Need Food, Wood, Stone, Heat
var wf, ww, ws, wh, wg; //Worker food, wood, stone, heat
var tx, ty, tp, tid; //Temp Territory vars, X, y, points(score), id
var tf, tw, ts, tg; //total res harvested to rebalance the max storage
var woodsup;
var starve=false;

var lv=0.16; //Livetime value of a unit (Absolutely no usecase in V1.5 but could be essential later on.)

var sct=0;//Scout

var cf=[0,0,0,0,0,0,0],cw=[0,0,0,0,0,0,0],cs=[0,0,0,0,0,0,0],cg=[0,0,0,0,0,0,0];
var cycle=0, ncycle;
var minr,maxr;

//Build Building Array
	//Set a score on every tile
	//Set best building for tile
	//Later when building, loop through empty territory and build best
	//Build if res exceeds 10%
	//Only build if available


var bt=[];//Node State, score, distance, boosted
//Add var bt as well if we get second building
for(i=0;i<40;i++){
	bt.push([]);
	for(j=0;j<40;j++){
		bt[i].push(['N',0,0]);
	}
}

//Only build if minimum is met so advancement isnt hindered.

//Handles Buildings
var build;
var bc=0;
var nb=[],rem;
var bl=1,bf=1,bq=1;	
var fst, sst, gst, wst, tst; //Res Status, temp status

var woff,goff,soff; 


connection.on("ReceiveBotState", gameState => {
	
	console.time('tick');
	w=gameState.world;
	a=w.map.availableNodes;
	b=gameState.bots;
	p=gameState.populationTiers;
	
	r=w.currentTick;
	console.log("Tick:"+r);
	
	cycle=Math.floor(r/10);
	if(r%10==0){
		cs.shift();cs.push(0);
		cf.shift();cf.push(0);
		cw.shift();cw.push(0);
		cg.shift();cg.push(0);
	}
	
	if(r==1){
		//Set up initial data
		bi=gameState.botId;
		for(i = b.length-1; i>=0; i--){
			if(b[i].id==bi){
				mx=b[i].baseLocation.x;my=b[i].baseLocation.y;
				mid=i;
			} else {
				en.push(["ENEMY"]);
			}
		}
		
		for(i = 0; i<w.map.scoutTowers.length; i++){
			  tn=w.map.scoutTowers[i];
			  s.push([tn.id,tn.position.x,tn.position.y,bR(d(tn.position.x,tn.position.y,mx,my))]);
				
			  bt[tn.position.y][tn.position.x][0]='X';
			
		 	}
		s.sort(function(a,b){return a[3]-b[3]});
		}
	
	m={"playerId" : bi,"actions" : []} 
	

	ma=b[mid].availableUnits;
	mp=b[mid].population;
	mf=b[mid].food;
	mw=b[mid].wood;
	mo=b[mid].stone;
	mh=b[mid].heat;
	mg=b[mid].gold;
	msc=b[mid].map.scoutTowers.length;
	mct=b[mid].currentTierLevel;
	
	goff=p[mct].tierResourceConstraints.gold;soff=p[mct].tierResourceConstraints.stone;woff=p[mct].tierResourceConstraints.wood;
	
	act=[];
	for(j = b[mid].actions.length-1; j>=0; j--){
		tn=b[mid].actions[j];
		if(tn.actionType==8||tn.actionType==7||tn.actionType==6){act.push(tn.targetNodeId);}
	}
	
	//If NB no longer in act, remove...
	for(i = nb.length-1; i>=0; i--){
		rem=true;
		for(j = act.length-1; j>=0; j--){if(act[j]==nb[i][3]){rem=false;}}
		if(rem){nb.splice(i, 1);}
	}
	
	//Reajust offsets from already built buildings
	for(i = nb.length-1; i>=0; i--){
		woff=woff+nb[i][4];
		soff=soff+nb[i][5];
		goff=goff+nb[i][6];
	}
	
	fst=b[mid].statusMultiplier.foodReward;
	sst=b[mid].statusMultiplier.stoneReward;
	gst=b[mid].statusMultiplier.goldReward;
	wst=b[mid].statusMultiplier.woodReward;
	
	//To Do
		//Add resources to nb. 
		//Remove from stockpile res while exists in DB
	
	if(sc<msc){
		tn=b[mid].map.scoutTowers;
		for(j=msc-1;j>=0;j--){
			for(k=s.length-1;k>=0;k--){
				if(s[k][0]==tn[j]){
					s.splice(k, 1);
				}
			}
		}
		sc=msc;
	}
	
					
	if(mrn<w.map.nodes.length){
		//fn=[];sn=[];wn=[];
		for(j = w.map.nodes.length-1; j>=0; j--){
			tn=w.map.nodes[j];
			tx=tn.position.x;ty=tn.position.y;
			if(bt[ty][tx][0]!='N'&&bt[ty][tx][0]!='E'){continue;}
			
			ds=bR(d(tx,ty,mx,my))+tn.workTime;
						
			if(tn.type==1){
				wn.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);	
			} else if(tn.type==2){
				fn.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			} else if(tn.type==3){
				sn.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			} else if(tn.type==4){
				gd.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			} else {
				console.log("Found Something Strange:"+JSON.stringify(tn));
			}
			
			bt[ty][tx][0]='X';
			bt[ty][tx][1]=Math.round(tn.reward/ds * 100) / 100;
			
			//To Do, remove above duplication.
				//Where do I find nodes I can actually use's IDs???
				//Later Zero score on nodes thats empty when i remove them...
		}
					
		mrn=w.map.nodes.length;
		wn.sort(function(a,b){return b[4]-a[4]});
		fn.sort(function(a,b){return b[4]-a[4]});
		sn.sort(function(a,b){return b[4]-a[4]});
		gd.sort(function(a,b){return b[4]-a[4]});
	}
	
	if(wn.length>0){
	   woodsup=0;
	   }
	
	for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						if(tn.type==1){
							//On Empty change build scores for tile
							for(j=wn.length-1;j>=0;j--){if(wn[j][0]==tn.id){
								if(tn.amount<=0){wn.splice(j, 1);continue;}
								wn[j][1]=tn.maxUnits-tn.currentUnits;wn[j][3]=tn.amount-(tn.currentUnits*tn.reward);}}
							woodsup=woodsup+tn.amount;
						} else if(tn.type==2){
							for(j=fn.length-1;j>=0;j--){if(fn[j][0]==tn.id){fn[j][1]=tn.maxUnits-tn.currentUnits;fn[j][3]=tn.amount-(tn.currentUnits*tn.reward);}}
						} else if(tn.type==3){
							for(j=sn.length-1;j>=0;j--){if(sn[j][0]==tn.id){sn[j][1]=tn.maxUnits-tn.currentUnits;sn[j][3]=tn.amount-(tn.currentUnits*tn.reward);}}
						} else {
							for(j=gd.length-1;j>=0;j--){if(gd[j][0]==tn.id){gd[j][1]=tn.maxUnits-tn.currentUnits;gd[j][3]=tn.amount-(tn.currentUnits*tn.reward);}}
						}
					}
	
	if(woodsup<50000){
		starve=true;
		i=cycle;
		j=mp;
		nh=mh+(Math.floor(mw/3*5));
		for(i=cycle;i<250;i++){
			nh=nh-j;
			if(nh<0){break;}
			j=Math.ceil(j*1.05);
			if(i==248){starve=false;}
		}
	}
	
	minr=0;maxr=2500;
	
	if(ma>0){
		
		calcNeeds();
		
		nf=nf+mp;
		tf=tf+mp;
		nh=nh+mp;
		
		nw=nw+1;
		tw=tw+1;
		
		if(nh>0){nw=nw+(Math.ceil(nh/5)*3);
				tw=tw+(Math.ceil(nh/5)*3);
				}
		
		wf=0; ww=0; wh=0; ws=0;
		farm();
		burn();
		cut();
		
			for(j=0;j<3;j++){if(ma<=0){break;}
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
		
		if(s.length>0){scout();}
	
		//Handles Buildings
		
		//On build
		
		
		
		
		//Diagnose above, Why is my buildings failing
		
		
		
		//Try and replenish what was spent on buildings (Via NW)
			//Dont build out of own 
		
		
		//Absolute build, Allow as much building as you want. BUT no building in new building ranges
			//Array that stores building x, y and radius
			//Loop through newbuildings and check if territory target falls within zone. 
			//No more need for BC either...
			//Adjust NF after build phase so units can farm res they just used for building so long.
		
		//Allow build only if mw+next constraints>=65...
			//Cannot allow building new to hinder my developments
		
		
		//Buildings work as follows
			//On build, travel starts, After travel, requires x time to build and takes res after completion or something like that
			//Check gamestate for building info incase its there
			//Else add building into array
				//Add res into array
				//Keep alive while exists. 
				//Use the NT array for the heck of it. Will prevent duplicate builds. 
				//Always keep upcomming building res in reserve. And effectively remove it from my supply (so I will try and farm it back)
				//I see some wastage coming in that case... Maybe fix for the last event
				
		
		
		
		if(ma>0&&bc>0){
			nw=nw+p[mct].tierMaxResources.wood-tw;
			ns=ns+p[mct].tierMaxResources.stone-ts;
			ng=ng+p[mct].tierMaxResources.gold-tg;
			nf=nf+p[mct].tierMaxResources.food-tf;	
			
			if(heatreq>0&&!starve){nf=Math.ceil(nf/2);}
			
			wf=0; ww=0; wh=0; ws=0; wg=0;

			mineGD();
			mineSN();
			cut();
			farm();
		}
		
		
		build=true;
		
		if((bc%4==0||bc%4==2)&&mw-woff>50*bl&&mo-soff>=50*bl&&mg-goff>=20*bl){
		} else if(bc%4==1&&mw-woff>65*bf&&mo-soff>=65*bf&&mg-goff>=30*bf){
		} else if(bc%4==3&&mw-woff>100*bq&&mo-soff>=100*bq&&mg-goff>=50*bq){
		} else {build=false;}
		
		//Dont even process territory if I cant build anything (Territory is a heavy calculation)
			//Just build 50 for challenge, dont over commit before tests
		
		//if(bc>16){build=false;}//Just test with 4 buildings
		while(ma>0&&build&&bc<20){
			
			//Territory
			for(j = a.length-1; j>=0; j--){
				tx=a[j].position.x;
				ty=a[j].position.y;

				if(bt[ty][tx][0]=='N'){bt[ty][tx][0]='E';}
				if(bt[ty][tx][0]=='X'){bt[ty][tx][0]='T';}
				}

			mt=[];
			for(j = a.length-1; j>=0; j--){
				tx=a[j].position.x;
				ty=a[j].position.y;

				if(bt[ty][tx][0]=='T'){continue;}
				tid=a[j].id;
				tp=0;
				ds=bR(d(tx,ty,mx,my));

				calcScore();

				mt.push([tx,ty,tp,tid,ds]);
			}
	
	mt.sort(function (a, b){return b[2]-a[2]||a[4]-b[4];});
	
	console.log("Territory Array"+JSON.stringify(mt));
			
			for(i = 0; i<nb.length; i++){
				if(mt[0][1]<=nb[i][1]+2&&mt[0][1]>=nb[i][1]-2&&mt[0][0]<=nb[i][0]+2&&mt[0][0]>=nb[i][0]-2){
				   mt.shift();i--;
				   }
			}
			
			if(mt.length==0){break}
			tx=mt[0][0];
			ty=mt[0][1];
			
			if((bc%4==0||bc%4==2)&&mw-woff>50*bl&&mo-soff>=50*bl&&mg-goff>=20*bl){
				bt[ty][tx][0]='T';
				mw=mw-(50*bl);mo=mo-(50*bl);mg=mg-(20*bl);
				nb.push([tx,ty,1,mt[0][3],50*bl,50*bl,20*bl]);
				bc++;bl=bl+0.5;
				m.actions.push({"type" : 8,"units" : 1,"id" : mt[0][3]});
				console.log("Try:"+JSON.stringify({"type" : 8,"units" : 1,"id" : mt[0][3]})+" X:"+tx+" Y:"+ty);
			} else if(bc%4==1&&mw-woff>65*bf&&mo-soff>=65*bf&&mg-goff>=30*bf){
				bt[ty][tx][0]='T';
				mw=mw-(65*bf);mo=mo-(65*bf);mg=mg-(30*bf);
				nb.push([tx,ty,1,mt[0][3],65*bf,65*bf,30*bf]);
				bc++;bf=bf+0.5;
				m.actions.push({"type" : 7,"units" : 1,"id" : mt[0][3]});
				console.log("Try:"+JSON.stringify({"type" : 7,"units" : 1,"id" : mt[0][3]})+" X:"+tx+" Y:"+ty);
			} else if(bc%4==3&&mw-woff>100*bq&&mo-soff>=100*bq&&mg-goff>=50*bq){
				bt[ty][tx][0]='T';
				mw=mw-(100*bq);mo=mo-(100*bq);mg=mg-(50*bq);
				nb.push([tx,ty,1,mt[0][3],100*bq,100*bq,50*bq]);
				bc++;bq=bq+0.5;
				m.actions.push({"type" : 6,"units" : 1,"id" : mt[0][3]});
				console.log("Try:"+JSON.stringify({"type" : 6,"units" : 1,"id" : mt[0][3]})+" X:"+tx+" Y:"+ty);
			} else {
				build=false;	
			}
		}
	
	console.log("Buildings:"+bc);	
		
		
		if(ma>0&&heatreq>0){
		   nh=Math.ceil(mw-p[mct+1].tierResourceConstraints.wood*3); 
		   if(nh>0){nw=nw+(Math.ceil(nh/5)*3);}	
			
		   wf=0; ww=0; wh=0; ws=0;
			
		   burn();
		   cut();
		   }
		
		
		
		
		
		for(i=1;i<=7;i++){
			mp=Math.ceil(mp*1.05);
			if(mp>=p[mct].maxPopulation){minr=(cycle+i)*10+2;
										 
										 nw=nw+p[mct+1].tierMaxResources.wood-tw;
										 ns=ns+p[mct+1].tierMaxResources.stone-ts;
										 ng=ng+p[mct+1].tierMaxResources.gold-tg;
										 nf=nf+p[mct+1].tierMaxResources.food-tf;
										
										 wf=0; ww=0; wh=0; ws=0; wg=0;
										 
										 mineGD();
										 mineSN();
										 cut();
										 farm();
										 
										 break;
										}
			}
		
		
		}
	
	sct--;
	
	if(m!=""){
		connection.invoke("SendPlayerCommand", m);
		//console.log(JSON.stringify(m));
		}
	
	console.timeEnd('tick');
	
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
			ng=(mg*-1)-cg[0]-cg[1]-cg[2]-cg[3]-cg[4]-cg[5]-cg[6];
			nw=(mw*-1)-cw[0]-cw[1]-cw[2]-cw[3]-cw[4]-cw[5]-cw[6];
			
			ts=0;tf=0;tw=0;tg=0;
		}

//if in territory add statusnode to my mining power.
	//Does not seem to affect my mining negatively

function farm(){
	for(i = 0; i<fn.length; i++){if(nf<1||ma<=0){break;}
		if(r+fn[i][5]<minr||r+fn[i][5]>maxr){continue;}
		if(fn[i][1]==0||fn[i][3]==0){continue;}
								 
		if(bt[fn[i][7]][fn[i][6]][0]=='X'){tst=fst;}else{tst=0;}						 
								 
		if(fn[i][3]>nf){wf=Math.ceil(nf/(fn[i][2]+tst));}
		else {wf=Math.ceil(fn[i][3]/(fn[i][2]+tst));}					 
		if(ma<wf){wf=ma;}
		if(fn[i][1]<wf){wf=fn[i][1];}					 
		if(wf>0){m.actions.push({"type" : 3,"units" : wf,"id" : fn[i][0]});ma=ma-wf;
							fn[i][3]=fn[i][3]-(wf*fn[i][2]);
							nf=nf-(wf*(fn[i][2]+tst));
				 			fn[i][1]=fn[i][1]-wf;
				 			
				 			ncycle=Math.floor((r+fn[i][5])/10)-cycle;
				 			cf[ncycle]=cf[ncycle]+(wf*(fn[i][2]+tst));
				}
	}
}


function cut(){
	for(i = 0; i<wn.length; i++){if(nw<1||ma<=0){break;}
		if(r+wn[i][5]<minr||r+wn[i][5]>maxr){continue;}
		if(wn[i][1]==0||wn[i][3]==0){continue;}
								 
		if(bt[wn[i][7]][wn[i][6]][0]=='X'){tst=wst;}else{tst=0;}						 
								 
		if(wn[i][3]>nw){ww=Math.ceil(nw/(wn[i][2]+tst));}
		else {ww=Math.ceil(wn[i][3]/(wn[i][2]+tst));}
		if(ma<ww){ww=ma;}
		if(wn[i][1]<ww){ww=wn[i][1];}
		if(ww>0){m.actions.push({"type" : 4,"units" : ww,"id" : wn[i][0]});ma=ma-ww;
				 			wn[i][3]=wn[i][3]-(ww*wn[i][2]);
							nw=nw-(ww*(wn[i][2]+tst));
				 			wn[i][1]=wn[i][1]-ww;
				 
				 			ncycle=Math.floor((r+wn[i][5])/10)-cycle;
				 			cw[ncycle]=cw[ncycle]+(ww*(wn[i][2]+tst));
							}
		
	}
}

function mineSN(){
	for(i = 0; i<sn.length; i++){if(ns<1||ma<=0){break;}
		if(r+sn[i][5]<minr||r+sn[i][5]>maxr){continue;}
		if(sn[i][1]==0||sn[i][3]==0){continue;}
		
		if(bt[sn[i][7]][sn[i][6]][0]=='X'){tst=sst;}else{tst=0;}							 
								 
		if(sn[i][3]>ns){ws=Math.ceil(ns/(sn[i][2]+tst));}
		else {ws=Math.ceil(sn[i][3]/(sn[i][2]+tst));}
		if(ma<ws){ws=ma;}
		if(sn[i][1]<ws){ws=sn[i][1];}					 
		if(ws>0){m.actions.push({"type" : 2,"units" : ws,"id" : sn[i][0]});ma=ma-ws;
				 			sn[i][3]=sn[i][3]-(ws*sn[i][2]);
							ns=ns-(ws*(sn[i][2]+tst));
				 			sn[i][1]=sn[i][1]-ws;
				 
				 			ncycle=Math.floor((r+sn[i][5])/10)-cycle;
				 			cs[ncycle]=cs[ncycle]+(ws*(sn[i][2]+tst));
							}
		
	}
}

function mineGD(){
	for(i = 0; i<gd.length; i++){if(ng<1||ma<=0){break;}
		if(r+gd[i][5]<minr||r+gd[i][5]>maxr){continue;}
		if(gd[i][1]==0||gd[i][3]==0){continue;}
								 
		if(bt[gd[i][7]][gd[i][6]][0]=='X'){tst=gst;}else{tst=0;}							 
								 
		if(gd[i][3]>ng){wg=Math.ceil(ng/(gd[i][2]+tst));}
		else {wg=Math.ceil(gd[i][3]/(gd[i][2]+tst));}
		if(ma<wg){wg=ma;}
		if(gd[i][1]<wg){wg=gd[i][1];}					 
		if(wg>0){m.actions.push({"type" : 2,"units" : wg,"id" : gd[i][0]});ma=ma-wg;
				 			gd[i][3]=gd[i][3]-(wg*gd[i][2]);
							ng=ng-(wg*(gd[i][2]+tst));
				 			gd[i][1]=gd[i][1]-wg;
				 
				 			ncycle=Math.floor((r+gd[i][5])/10)-cycle;
				 			cg[ncycle]=cg[ncycle]+(wg*(gd[i][2]+tst));
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
		mw=mw-wh;
	}
}

function scout() {
	if(sct<1){
				for(i = 0; i<s.length; i++){if(ma==0||i>1){break;}m.actions.push({"type" : 1,"units" : 1,"id" : s[i][0]});ma--;sct=s[i][3];}
		} 
}


//Calculate score based on amount of nodes I can add in my own territory, 50% bonus for empty
function calcScore(){
	for(k=ty-2;k<=ty+2;k++){if(k<0||k>39){continue;}
			for(i=tx-2;i<=tx+2;i++){if(i<0||i>39||i==k){continue;}
				//if(bt[k][i][0]=='N'){tp=tp+0.5;} else 				  
				if(bt[k][i][0]!='E'&&bt[k][i][0]!='T'){tp++;}//prioritize closest (faster building and better for own expanses)
			}	
		}		
}


//Building Cost:
	//private static int GetBuildingCost(int numberOfBuildingsPerType, int cost) => (numberOfBuildingsPerType * cost) / 2;

	//Set initial cost. 
		//Count all buildings
		//Recalc Cost
		//No limit on building. Happens pretty instant
		//Will anyways not retry build. Maybe limit build to 1 per turn on cheapest building.
	
	//Rebalance my mining and see how it impacts Rewards???

//How does it impact my resources???
	//Score Multiplier -> just a small increase to score at the end.
	//Population is worth more. Keep in mind...

//??Statud Effect Multiplier
	//Calculate Amount Extracted
	//Seems to be if node is in my territory, Add status modifier to my farm (per unit)

//check if status effect auto applies... only play 16 buildings at first


