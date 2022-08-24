const signalR = require("@microsoft/signalr");
const token = process.env["REGISTRATION_TOKEN"] ?? createGuid();

let url = process.env["RUNNER_IPV4"] ?? "http://localhost";
url = url.startsWith("http://") ? url : "http://" + url;
url += ":5000/runnerhub";

let w, a, b, bi, p, t; //World Vars
var i,j,k,l //generic loops
var ds;

let r; //Round (Maybe Redundent)
let m; //Moves
var mx, my, ma, mp, ms, mct, mrn=0, mid; //x,y,available,population, scout, tier, resnodes
var myp, myc, ep, ec;

var sct=false;

var en;
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
var nu, radical;;

var tn;//Temp Nodes

var nt;

var mf, mw, mo, mh, mg; //Food, Wood, Stone, heat
var nf, nw, ns, nh, ng; //Need Food, Wood, Stone, Heat
var wf, ww, ws, wh, wg; //Worker food, wood, stone, heat
var tx, ty, tp, np, ttp, tb, tid; //Temp Territory vars, X, y, new points, points(score), temporary Points,building 
var starve=false;


var fr=[]; //Future Resources
var offw, offg, offs;//offset FR and account for Advancements (Had an issue where I would see more stone than I can farm because of lumber expantions that caused a lot of chaos in my build strat)
var offwx, offgx, offsx;

var cycle=0;
var minr,maxr;
var cbuild = true;

//just temp

var mbuild=0, abuild;

//More Lumbermills will free up more units  for Territory Conquest
	
//For Expantion, Try and expand towards the center. 
	//Everyone is limited by expand speed, 
	//But if I can expand towards the center first I can grab whats behind me later on. Even if I get flanked I can just grab territory in my own quadrent
	//Territorial advantage can only be combat by other bots through takeover. 
	//Takeover reduces Heat 

//Always prioritize Heat and Lumber. 
	//Observations are that as I get my lumber sorted, I cant overfarm Wood and end with lots of free units. 
	//those Units can takeover

var bt=[];//Node State, score, distance, boosted
//Add var bt as well if we get second building
for(i=0;i<40;i++){
	bt.push([]);
	for(j=0;j<40;j++){
		bt[i].push(['N',0]);
	}
}

//Handle 
var nb=[], rem, build=[], canbuild=[];
var fst, mst, wst; //Res Status, temp status
var wr,gr,sr;
var adv, advr;
var bphase=1;

var quad="";

//build Array - Building, amount modifier, total cost, territory weight, size (according to the MT array), build time
build.push(['R', 1, 50, 35, 0, 1, 9, 2]);
build.push(['Q', 1, 90, 45, 0, 2, 25, 5]);
build.push(['F', 1, 50, 25, 0, 2, 25, 5]);
build.push(['O', 1, 220, 110, 0, 3, 49, 10]);
build.push(['L', 1, 40, 15, 0, 1, 9, 5]);


var t1, t2, t3, t4, t5, tcomp; //temporary variables for performance boosts
var mwood, mstone, mgold;
var twr,tsr,tgr;	

//Lastly Territory
//Territory Vars Wood in Quadrant Own, [node, distance, ownpressure, enemypressure]
	var tmWoodQ=[]; //Own Wood in Own Quadrent
	var teWoodQ=[]; //Enemy Controled Wood in own Quadrent
	var tmWoodO=[]; //Own Wood Outer Quadrent
	var teWoodO=[]; //Enemy Wood Outer Quadrent
	var teOtherQ=[]; //Own Territory Non Wood Own Q
	var teOtherQ=[]; //Enemy Territory Non Wood Own Q
	var tmOtherO=[]; //Own Territory Non Wood Outer Quadrent
	var teOtherO=[]; //Enemy Territory Non Wood Outer Quadrent
	var mz; //zone



connection.on("ReceiveBotState", gameState => {

	w=gameState.world;
	a=w.map.availableNodes;
	b=gameState.bots;
	
	r=w.currentTick;
	console.log("Tick:"+r);
	
	
	cycle=Math.floor(r/10);
	if(r%10==0){cycle--;}
	
	if(r==1){
		
		p=gameState.populationTiers;
		
		//Set up initial data
		bi=gameState.botId;
		for(i = b.length-1; i>=0; i--){
			if(b[i].id==bi){
				mx=b[i].baseLocation.x;my=b[i].baseLocation.y;
				if(mx<20&&my<20){quad="NW";}
				else if(mx>20&&my<20){quad="NE";}
				else if(mx<20&&my>20){quad="SW";}
				else {quad="SE";}
				
				mid=i;
			} else {
			}
		} 
		
		
		
		for(i = 0; i<w.map.scoutTowers.length; i++){
			  tn=w.map.scoutTowers[i];
			  s.push([tn.id,bR(d(tn.position.x,tn.position.y,mx,my))]);
		 	}
		s.sort(function(a,b){return a[1]-b[1]});
		
		for(i=0;i<40;i++){
			for(j=0;j<40;j++){
				bt[i][j][1]=bR(d(j,i,mx,my));
				}
			}
		}
		
	m={"playerId" : bi,"actions" : []} 
	
	ma=b[mid].availableUnits;
	mf=b[mid].food;
	mw=b[mid].wood;
	mo=b[mid].stone;
	mh=b[mid].heat;
	mg=b[mid].gold;
	mct=b[mid].currentTierLevel;
	
	//Test a variation where we check Mo an MG and factor in already built buildings
	mp=b[mid].population;
	adv=0;for(i=1;i<=6;i++){
		if(mp<30516){mp=Math.ceil(mp*1.05);}
		else {mp=Math.ceil(mp*1.03);}
		if(mp>=p[mct].maxPopulation){adv=i;break;}
	}
	mp=b[mid].population;
	
	if(adv>0){advr=((cycle+adv)*10);}
	else {advr=5000;}
	
	
	abuild=0;
	
	//Try fetch building costs directly from bot data
	for(i=build.length-1;i>=0;i--){build[i][1]=1;
		for(j=b[mid].buildings.length-1;j>=0;j--){
			if((build[i][0]=='L'&&b[mid].buildings[j].type==8)||
			   (build[i][0]=='F'&&b[mid].buildings[j].type==7)||
			   (build[i][0]=='Q'&&b[mid].buildings[j].type==6)||
			   (build[i][0]=='O'&&b[mid].buildings[j].type==9)||
			   (build[i][0]=='R'&&b[mid].buildings[j].type==10)){abuild++;build[i][1]=build[i][1]+0.5;}
		}						  
	}
	
	//console.log(JSON.stringify(b[mid].buildings));
	
	fst=b[mid].statusMultiplier.foodReward;
	mst=b[mid].statusMultiplier.goldReward;
	wst=b[mid].statusMultiplier.woodReward;
	
	console.log("Current Status Multipliers: fst="+fst+",mst="+mst+",wst="+wst);
	
	//Future Res: fr= id, action, units, total offset, type (stone or gold)
	sct=false;
	fr=[];
	for(i = 0; i<b[mid].actions.length; i++){
		tn=b[mid].actions[i];
		
		if(tn.actionType==1){
			sct=true;
		}
		else if(tn.actionType==5){mw=mw-(Math.ceil(tn.numberOfUnits*3));mh=mh+(Math.ceil(tn.numberOfUnits/3)*5);}
		else if(tn.actionType>5){
			for(j=build.length-1;j>=0;j--){
				if((build[j][0]=='L'&&tn.actionType==8)||
			   (build[j][0]=='F'&&tn.actionType==7)||
			   (build[j][0]=='Q'&&tn.actionType==6)||
			   (build[j][0]=='O'&&tn.actionType==9)||
			   (build[j][0]=='R'&&tn.actionType==10)){build[j][1]=build[j][1]+0.5;}
			}
			
		}
		else {
			fr.push([tn.targetNodeId, tn.actionType, tn.numberOfUnits, 0, "", tn.tickActionCompleted]);
		}
	}

	
	for(j = nb.length-1; j>=0; j--){
		t1=true;
		for(i = 0; i<b[mid].actions.length; i++){
			tn=b[mid].actions[i];
			if(tn.actionType>5&&tn.targetNodeId==nb[j][3]){t1=false;}
		}
		if(t1){nb.splice(j, 1);}
		else{nb[j][7]=nb[j][7]-1;}
		}
	
	t=[]; //x, y, id, my pressure, my units, enemy pressure (best), enemy units (best)
	en=[]; //x, y, id, my pressure, my units, enemy pressure (best), enemy units (best)
	
	t1=b[mid].territory;
	
	for(j = t1.length-1; j>=0; j--){
			
			ep=0;ec=0;myp=0;myc=0;
			t2=t1[j].occupants;
			for(k = t2.length-1; k>=0; k--){
				if(t2[k].botId==bi){myp=t2[k].pressure;myc=t2[k].count;}
				else{
					if(ep<t2[k].pressure){ep=t2[k].pressure;ec=t2[k].count;}
					}
			}
			
			t.push([t1[j].y, t1[j].x, t1[j].nodeOnLand, myp, myc, ep, ec, bt[t1[j].y][t1[j].x][1]]);
			} 
	
	//console.log("My Borders:"+JSON.stringify(t));
	
	
	
	for(i = b.length-1; i>=0; i--){if(b[i].id==bi){continue;}
		t1=b[i].territory;						   
		for(j = t1.length-1; j>=0; j--){
			
			ep=0;ec=0;myp=0;myc=0;
			t2=t1[j].occupants;
			for(k = t2.length-1; k>=0; k--){
				if(t2[k].botId==b[i].id){ep=t2[k].pressure;ec=t2[k].count;}
				if(t2[k].botId==bi){myp=t2[k].pressure;myc=t2[k].count;}
			}
			
			if(myc>0){console.log("Enemy has Units:"+JSON.stringify(t1[j]));}
			
			en.push([t1[j].y, t1[j].x, t1[j].nodeOnLand, myp, myc, ep, ec, bt[t1[j].y][t1[j].x][1]]);
			} 
		}
	
	
	//console.log("Enemy Borders:"+JSON.stringify(en));
	
	cbuild=true;
	
		//For Territory
			//Phase 1 try and grab any Wood lots with resources.
				//Try and do this before I burn extra Heat even???
				//Try and expand and take resource nodes???
				//Resource Nodes should be easy to keep
		
		//Right before heat
	
		//Territory Strategy
			//Phase 1: Try and defend own quadrent (Retain - Res only)
			//Phase 2: Try and take own quadrent (Aim to land on a %9 tick)
			
		//At the very end if still have units
	
		//Territory Strategy
			//Phase 3: Try and take woodnode all (If has res)
			//Phase 4: Try and take closestnodes all
			//Phase 5: Reinforce Closest Wood (If has res)
			//Phase 6: Reinforce nodes that still have wood (Protect)
			
		//Withdrawal strat
			//Calc if node is important (A res node)
			//Else if own node, withdraw
		
		//What is the winning FActor? 
			//Still heat...
			//It was always about heat and the starve function...
			//In the finals undoubtedly the 4v4 will destroy resources on the map, and start fighting over territory. 
			//Defence will be cheaper than offence.
			//Neither Should I ignore Wood Nodes in the distance
	
	
	for(k=s.length-1;k>=0;k--){
		for(j=b[mid].map.scoutTowers.length-1;j>=0;j--){
			if(s[k][0]==b[mid].map.scoutTowers[j]){s.splice(k, 1);console.log("Removed Tower");break;}
		}
	}
	
	
	//Rebuild Map Nodes
	wn=[];fn=[];sn=[];gd=[];

	for(j = w.map.nodes.length-1; j>=0; j--){
		tn=w.map.nodes[j];
		if(tn.amount<=0){continue;}
		
		tx=tn.position.x;ty=tn.position.y;
		ds=bt[ty][tx][1]+tn.workTime;
		
		if(tn.type==1){
			wn.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			bt[ty][tx][0]='W';
		} else if(tn.type==2){
			fn.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			bt[ty][tx][0]='F';
		} else if(tn.type==3){
			sn.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			bt[ty][tx][0]='S';
		} else if(tn.type==4){
			gd.push([tn.id,tn.maxUnits-tn.currentUnits,tn.reward,tn.amount,Math.round(tn.reward/ds * 100) / 100, ds, tx, ty]);
			bt[ty][tx][0]='G';
		} else {
		}
	}
	
	
	//Update Own territory
	for(j = t.length-1; j>=0; j--){
				tx=t[j][1];
				ty=t[j][0];
				t1=bt[ty][tx][0];
		
				if(t1=='N'){bt[ty][tx][0]='E';}
				else if(t1=='W'){bt[ty][tx][0]='MW';}
				else if(t1=='F'||t1=='S'||t1=='G'){bt[ty][tx][0]='T';}
				else{}
				}
	
	//Update enemy territory on Map
	for(i = en.length-1; i>=0; i--){tx=en[i][1];ty=en[i][0];
					if(bt[ty][tx][0]=='N'){bt[ty][tx][0]='X';}
					if(bt[ty][tx][0]=='F'){bt[ty][tx][0]='EF';}
					if(bt[ty][tx][0]=='W'){bt[ty][tx][0]='EW';}
					if(bt[ty][tx][0]=='S'){bt[ty][tx][0]='ES';}
					if(bt[ty][tx][0]=='G'){bt[ty][tx][0]='EG';}
		} 
	
	//Update Enemy Buildings
	for(i = b.length-1; i>=0; i--){if(b[i].id==bi){continue;}
		for(j=b[i].buildings.length-1;j>=0;j--){
			t1=b[i].buildings[j];
				if(t1.type==6||t1.type==7||t1.type==8||t1.type==9||t1.type==10){bt[t1.position.y][t1.position.x][0]='EB';};
		}
	}
	
	//Territory Vars Wood in Quadrant Own, 
	teWoodQ=[]; //Enemy Controled Wood in own Quadrent
	teWoodO=[]; //Enemy Wood Outer Quadrent
	teOtherQ=[]; //Enemy Territory Non Wood Own Q
	teOtherO=[]; //Enemy Territory Non Wood Outer Quadrent
		
	//Populate Enemy Territory Zone Arrays
	for(i = en.length-1; i>=0; i--){tx=en[i][1];ty=en[i][0];t1=bt[ty][tx][0];	
		for(j = t.length-1; j>=0; j--){			   
				if(Math.abs(ty-t[j][0])<=1&&Math.abs(tx-t[j][1])<=1){
					
					mz=false;
					if(quad=="SE"&&tx>=20&&ty>=20){mz=true;}
					if(quad=="NW"&&tx<=19&&ty<=19){mz=true;}
					if(quad=="SW"&&tx<=19&&ty>=20){mz=true;}
					if(quad=="NE"&&tx>=20&&ty<=19){mz=true;}
					
					if(t1=='EW'&&mz){teWoodQ.push(en[i]);}
					if(t1!='EW'&&mz){teOtherQ.push(en[i]);}
					if(t1=='EW'&&!mz){teWoodO.push(en[i]);}
					if(t1!='EW'&&!mz){teOtherO.push(en[i]);}
					 
					break;
				}					   
			}
		}
	
	console.log("teWoodQ:"+JSON.stringify(teWoodQ));//Pass
	
	//Defend if time...
	tmWoodQ=[]; //Own Wood in Own Quadrent
	tmWoodO=[]; //Own Wood Outer Quadrent
	tmOtherQ=[]; //Own Territory Non Wood Own Q
	tmOtherO=[]; //Own Territory Non Wood Outer Quadrent
	
	//Populate Own Territory Zone Arrays
	for(j = t.length-1; j>=0; j--){tx=t[j][1];ty=t[j][0];t1=bt[ty][tx][0];
		for(i = en.length-1; i>=0; i--){
				if(Math.abs(en[i][1]-tx)<=1&&Math.abs(en[i][0]-ty)<=1){
					
					mz=false;
					if(quad=="SE"&&tx>=20&&ty>=20){mz=true;}
					if(quad=="NW"&&tx<=19&&ty<=19){mz=true;}
					if(quad=="SW"&&tx<=19&&ty>=20){mz=true;}
					if(quad=="NE"&&tx>=20&&ty<=19){mz=true;}
					
					if(t1=='MW'&&mz){tmWoodQ.push(t[j]);}
					if(t1!='MW'&&mz){tmOtherQ.push(t[j]);}
					if(t1=='MW'&&!mz){tmWoodO.push(t[j]);}
					if(t1!='MW'&&!mz){tmOtherO.push(t[j]);}
					
				}					   
			}
		}
	
	//Populate Own Territory Zone Arrays
	
	
	//Update Own territory
	for(j = t.length-1; j>=0; j--){
				tx=t[j][1];ty=t[j][0];
				t1=bt[ty][tx][0];if(t1!='MW'){continue;}
				bt[ty][tx][0]='T';
				}
	
	mwood=0;
	mstone=0;
	mgold=0;
	
	//Adjust Nodes for rewards (Own and Enemy)
	for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						
						t5=0;for(k=fr.length-1;k>=0;k--){if(tn.id==fr[k][0]){t5=t5+fr[k][2];}}
						t2=tn.currentUnits-t5;
						t4=Math.floor(tn.reward*0.7);	
		
						if(tn.type==1){
			
							for(j=wn.length-1;j>=0;j--){t1=wn[j];if(t1[0]==tn.id){
								t3=tn.reward+wst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									wn[j][2]=t3;
									wn[j][4]=Math.round(t3/bt[t1[7]][t1[6]][1] * 100) / 100;	
									wn[j][3]=tn.amount-(t5*t3)-(t2*t4);	
									mwood=mwood+wn[j][3];
									}
								if(bt[t1[7]][t1[6]][0]=='EW'){
									wn[j][2]=t4;
									wn[j][4]=Math.round(t4/bt[t1[7]][t1[6]][1] * 100) / 100;
									wn[j][3]=tn.amount-(t5*t4)-(t2*tn.reward);	
									}
							}}
						} else if(tn.type==2){
							for(j=fn.length-1;j>=0;j--){t1=fn[j];if(t1[0]==tn.id){
								t3=tn.reward+fst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									fn[j][2]=t3;
									fn[j][4]=Math.round(t3/bt[t1[7]][t1[6]][1] * 100) / 100;	
									fn[j][3]=tn.amount-(t5*t3)-(t2*t4);	
									}
								if(bt[t1[7]][t1[6]][0]=='EF'){
									fn[j][2]=Math.floor(tn.reward*0.7);
									fn[j][4]=Math.round(fn[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;	
									fn[j][3]=tn.amount-(t5*t4)-(t2*tn.reward);	
									}
							}}
						} else if(tn.type==3){
							for(j=sn.length-1;j>=0;j--){t1=sn[j];if(t1[0]==tn.id){
								t3=tn.reward+mst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									sn[j][2]=tn.reward+mst;
									sn[j][4]=Math.round(sn[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;	
									sn[j][3]=tn.amount-(t5*t3)-(t2*t4);
									mstone=mstone+sn[j][3];
									}
								if(bt[t1[7]][t1[6]][0]=='ES'){
									sn[j][2]=Math.floor(tn.reward*0.7);
									sn[j][4]=Math.round(sn[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;		
									sn[j][3]=tn.amount-(t5*t4)-(t2*tn.reward);	
									}	
							}}
						} else {
							for(j=gd.length-1;j>=0;j--){t1=gd[j];if(t1[0]==tn.id){
								t3=tn.reward+mst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									gd[j][2]=tn.reward+mst;
									gd[j][4]=Math.round(gd[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;	
									gd[j][3]=tn.amount-(t5*t3)-(t2*t4);	
									mgold=mgold+gd[j][3];
									}	
								if(bt[t1[7]][t1[6]][0]=='EG'){
									gd[j][2]=Math.floor(tn.reward*0.7);
									gd[j][4]=Math.round(gd[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;
									gd[j][3]=tn.amount-(t5*t4)-(t2*tn.reward);	
									}
							}}
						}
					}
	
	for(k=fr.length-1;k>=0;k--){
		for(j=wn.length-1;j>=0;j--){if(wn[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*wn[j][2];}}
		for(j=fn.length-1;j>=0;j--){if(fn[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*fn[j][2];}}
		for(j=sn.length-1;j>=0;j--){if(sn[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*sn[j][2];fr[k][4]='S';}}
		for(j=gd.length-1;j>=0;j--){if(gd[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*gd[j][2];fr[k][4]='G';}}
	}
	
	offw=0; offg=0; offs=0;
	offwx=0; offgx=0; offsx=0;
	
	for(k=fr.length-1;k>=0;k--){
		
		if(fr[k][5]<=advr){
			if(fr[k][1]==4){offw=offw+fr[k][3];}
				else if(fr[k][1]==2){
					if(fr[k][4]=='S'){offs=offs+fr[k][3];}
					else {offg=offg+fr[k][3];}
				}
				else {}
		} else {
			if(fr[k][1]==4){offwx=offwx+fr[k][3];}
				else if(fr[k][1]==2){
					if(fr[k][4]=='S'){offsx=offsx+fr[k][3];}
					else {offgx=offgx+fr[k][3];}
				}
				else {}
		}	
			}
	t1=p[mct].tierMaxResources;
	if(mw+offw>t1.wood){offw=t1.wood-mw;}
	if(mo+offs>t1.wood){offs=t1.stone-mo;}
	if(mg+offg>t1.wood){offg=t1.gold-mg;}
	   
	console.log("Offsets Current: offw"+offw+" offs"+offs+" offg"+offg+" offwx"+offwx+" offsx"+offsx+" offgx"+offgx);
	
	mwood=mwood+offw+offwx;
	
	wn.sort(function(a,b){return b[4]-a[4]});
	fn.sort(function(a,b){return b[4]-a[4]});
	sn.sort(function(a,b){return b[4]-a[4]});
	gd.sort(function(a,b){return b[4]-a[4]});
		
	for(j = nb.length-1; j>=0; j--){
		tx=nb[j][0];ty=nb[j][1];
		t1=nb[j][2];
		bt[ty][tx][0]='T';
		
		for(k=ty-t1;k<=ty+t1;k++){if(k<0||k>39){continue;}
			for(i=tx-t1;i<=tx+t1;i++){if(i<0||i>39||i==k){continue;}
				t2=bt[k][i][0];
				if(t2=='F'){bt[k][i][0]='FF';}	
				if(t2=='N'){bt[k][i][0]='FE';}	
				if(t2=='W'){bt[k][i][0]='FW';}
				if(t2=='S'){bt[k][i][0]='FS';}
				if(t2=='G'){bt[k][i][0]='FG';}
			}
		}
	}
	
	console.log("My Territorial Res left: W="+mwood+" S="+mstone+" G="+mgold);

	//Set cBuild according to Territorial res
	
	//console.log("Future Farm Vars:"+JSON.stringify(fr));
	
	//Try running Woodsup only on nodes in own territory but set to 200 000
	
	//set starve to 
	
	//Set 
	
	starve=false;
	if(bphase==3&&mwood<200000){
		i=cycle;
		j=mp;
		t1=mf;
		t2=0;
		t3=mw+offw+offwx;
		
		nh=mh+(Math.floor(t3/3*5));
		for(i=cycle;i<250;i++){
			nh=nh-j;
			if(i>(248-t2)){starve=false;break;}
			if(nh<=0){starve=true;break;}
			if(t1>0){t1=t1-j;t2++;}
			if(j<30516){j=Math.ceil(j*1.05);}
			else {j=Math.ceil(j*1.03);}
		}
		if(starve){console.log("Starve Status:"+starve+" should end:"+i+" offset:"+t2);}
	}
	
	//Set Goldsup anmd Stonesup
		//Use that to deturmine if I can build or not
	
	//Build Phase 3
		//Calculate unit saving / speed boost on Lumber
		//check if I can afford it according to what I own in my territory
		//If unit diff >farmtime -> continue
	
	//Has to combine with agrression
		//If I have unit advantage i can try and take more territory
		
	
	
	//Calculate when it will be worth building lumber or food...
		//From a unit loss / gain perspective...
		//Burn Map resources on build advantage
		//Use those buildings to build a wall around my territory as much as possible. 
	
	//Calculate wood in own territory
		//Calculate impact of building a lumbermill 
		//So take how many units will be required to farm the res
		//Then calculate how many units will  
	
	//Consider Emptying "Hot Bases" first
		//This would look like: "If Base was taken over"
		//Set as Preference for Wood harvesting
		//Can possibly push back enemy
		//Dont takeover empty wood lots. 
	
	
	minr=0;maxr=2499;
	
	//Step 1: Try and get what I need to maintain population (Complete)
	if(ma>0){
		
		calcNeeds();
		
		nf=nf+mp;
		nh=nh+mp;
		
		farm();
		burn();
		cut();
		
		//Step 2: Try and get what I need to advance population (Complete)
		
			for(j=0;j<4;j++){if(ma<=0){break;}
				nf=nf+Math.ceil(mp/1.2);
				nh=nh+Math.ceil(mp/0.9);
				
				farm();		 
				burn();
				cut();
			}
		}
	
		//Step 3: Scout (Complete)
		scout();
		
		//Step 4: Make sure I have enough food for next advancement (only if ADV near)
			//This tweak seems reasonable and could lower my onhand food requirements even further. Always best to try and push extra units down the funnel so other advancement strategies take preference.
		if(ma>0&&adv>0&&adv<=2){
			nf=nf+(p[mct+1].tierResourceConstraints.food-(Math.ceil(mp/1.2)*3));
			farm();
		}
		
		//Step 5: Build for territory as best I can
		
		//Build Phase 3
			//calculate the advantage that building would give (Speed boost)
			//if unit advantage exceeds replacement costs - build
		
		
		//set and calculate an afford variable
			//If I cant afford anything, allow unthrottled heat
			
		//bphase 3 calculate value of lumbermill
			//If high, allow unthrottled heat
		
		
	
	
		if(ma>0&&cbuild){
			
			wr=mw;
			gr=mg;
			sr=mo;
			
			if(adv>0){
				t1=p[mct+1].tierResourceConstraints;
				
			    wr=wr-t1.wood-1;
				gr=gr-t1.gold-1;
				sr=sr-t1.stone-1;
			   }
		
			//Readjust offsets from already built buildings
			for(i = nb.length-1; i>=0; i--){wr=wr-nb[i][4];sr=sr-nb[i][5];gr=gr-nb[i][6]; }
			
			
			
			if(bphase==3){console.log("Can Build Wood:"+wr+" Stone:"+sr+" Gold:"+gr);}
			
			//calculate building territory weights
			for(j = build.length-1; j>=0; j--){
				build[j][4]=((2*build[j][2])+build[j][3])*build[j][1]/build[j][6];
			}
			
			//Building Phase 1
			
			//build.sort(function (a, b){return a[5]-b[5];});
			if(build[4][0]=='L'&&build[4][1]==1){canbuild=['L'];}
			else if(bphase==1){canbuild=['R', 'O', 'Q', 'F', 'L'];} //Fastest territory
			else if(bphase==2){canbuild=['Q', 'F', 'L'];}//Just Lumber, Farm Quarry //Cheapest territory
			else if(bphase==3){canbuild=['L'];}//Just lumber, No sort
			else {}
			
			//console.log("Build:"+JSON.stringify(build));
			
			if(bphase==1||bphase==2){
			//console.log("Building Phase Active :"+bphase);
			//Territory
			//[tx,ty,tid,s1,s2,s3] (Each tile can have the best score for all building types then)
			mt=[];
			for(j = a.length-1; j>=0; j--){
				tx=a[j].position.x;
				ty=a[j].position.y;
				if(bt[ty][tx][0]=='T'){continue;}
				
				tid=a[j].id;
				t2=calcScore(1);
				t3=calcScore(2);
				t4=calcScore(3);
				if(t2+t3+t4>0){mt.push([tx,ty,tid,calcScore(1),calcScore(2),calcScore(3)]);}
			}
			
				//Fastest Territory
					//build.sort(function (a, b){return b[5]-a[5];});
				
				//Cheapest Expand
					//build.sort(function (a, b){return a[4]-b[4];});
				
			for(i=canbuild.length-1;i>=0;i--){if(mt.length==0){if(nb.length==0){bphase++;}break;}	
				for(j = build.length-1; j>=0; j--){
					if(canbuild[i]==build[j][0]){								   
												   
					t1=build[j][0];	
					t2=build[j][1];	
					t3=build[j][2];	
					t4=build[j][3];	
					t5=build[j][5];

					mt.sort(function (a, b){return b[t5+2]-a[t5+2];});
					if(mt[0][t5+2]==0){continue;}
					
					tx=mt[0][0];ty=mt[0][1];tid=mt[0][2];	
					tcomp=bt[ty][tx][1]+build[j][7];
					
					twr=wr;tsr=sr;tgr=gr;

					for(k=fr.length-1;k>=0;k--){
						if(fr[k][5]<tcomp+r){
							if(fr[k][1]==4){twr=twr+fr[k][3];}
							else if(fr[k][1]==2){
								if(fr[k][4]=='S'){tsr=tsr+fr[k][3];}
								else {tgr=tgr+fr[k][3];}
							}
							else {}
						}
					}	
					
					if(tcomp+r<advr){
						if(tgr>p[mct].tierMaxResources.gold){tgr=p[mct].tierMaxResources.gold;}
						if(twr>p[mct].tierMaxResources.wood){twr=p[mct].tierMaxResources.wood;}
						if(tsr>p[mct].tierMaxResources.stone&&build[4][1]>1){tsr=p[mct].tierMaxResources.stone;}
					}
					
					//console.log("Trying:"+canbuild[i]+" End Vars: twr-"+twr+" t3*t2-"+(t3*t2)+" tsr-"+tsr+" t3*t2-"+(t3*t2)+" tgr-"+tgr+" t4*t2-"+(t4*t2));
					
					if(twr>t3*t2&&tsr>=t3*t2&&tgr>=t4*t2){mbuild++;

						bt[ty][tx][0]='T';

						nb.push([tx,ty,build[j][5],tid,t3*t2,t3*t2,t4*t2,tcomp+1,t3*t2,t4*t2]);
														  
						ma--;

						if(t1=='L'){m.actions.push({"type" : 8,"units" : 1,"id" : tid});
							console.log("Build:"+JSON.stringify({"type" : 8,"units" : 1,"id" : tid})+" X:"+tx+" Y:"+ty);}

						if(t1=='F'){m.actions.push({"type" : 7,"units" : 1,"id" : tid});
							console.log("Build:"+JSON.stringify({"type" : 7,"units" : 1,"id" : tid})+" X:"+tx+" Y:"+ty);}

						if(t1=='Q'){m.actions.push({"type" : 6,"units" : 1,"id" : tid});
							console.log("Build:"+JSON.stringify({"type" : 6,"units" : 1,"id" : tid})+" X:"+tx+" Y:"+ty);}

						if(t1=='O'){m.actions.push({"type" : 9,"units" : 1,"id" : tid});
							console.log("Build:"+JSON.stringify({"type" : 9,"units" : 1,"id" : tid})+" X:"+tx+" Y:"+ty);}

						if(t1=='R'){m.actions.push({"type" : 10,"units" : 1,"id" : tid});
							console.log("Build:"+JSON.stringify({"type" : 10,"units" : 1,"id" : tid})+" X:"+tx+" Y:"+ty);}

						i=-1;break;
						} 

				}
												  
			}}
			}
			
			//Building Phase 3
			if(bphase==3&&cbuild){
				//console.log("Building Phase 3 Active");
			}
			
		}
		
		if(ma>0){
			//Account for all res already harvested? 
			t1=p[mct].tierMaxResources;
			
			ns=(mo*-1)-offs;
			ng=(mg*-1)-offg;
			nw=(mw*-1)-offw;
			
			nw=nw+t1.wood;
			ns=ns+t1.stone;
			ng=ng+t1.gold;
			
			mineSN();
			mineGD();
		}
		
	
		
	
		//Lets Future Farm only chosen once for every building
	
		if(ma>0&&nb.length>0){
				for(j = nb.length-1; j>=0; j--){
					minr=r+nb[j][7]+1;
					if(ns<=0&&ns+nb[j][8]>0){
						ns=ns+nb[j][8];
						console.log("FF Build Stone:"+ns);
						mineSN();
						if(ns<0){ns=0;}
						nb[j][8]=ns;
					}
					
					if(ng<=0&&+ng+nb[j][9]>0){
						ng=ng+nb[j][9];
						console.log("FF Build Gold:"+ng);
						mineGD();
						if(ng<0){ng=0;}
						nb[j][8]=ng;
					}
					
					
				}
			}
		
		//Only Future Farm building from best stone supply...
	
		minr=0;	
		//Step 8: Finish Wood Req above
		if(ma>0){cut();}
		
		//Step 9: If closest gathering will happen after my uptick, allow early harvest. Harvest evenly so that I have more build options
		if(ma>0&&adv>0){
				minr=(cycle+adv)*10+2;maxr=minr+7;
				
				if(sn.length>0){if(r+sn[0][5]>minr&&r+sn[0][5]<maxr){
					ns=ns-offsx;ns=ns+p[mct+1].tierMaxResources.stone-p[mct].tierMaxResources.stone;
					mineSN();console.log("FFI Stone");}}
				if(gd.length>0){if(r+gd[0][5]>minr&&r+gd[0][5]<maxr){
					ng=ng-offgx;ng=ng+p[mct+1].tierMaxResources.gold-p[mct].tierMaxResources.gold;
					mineGD();console.log("FFI Gold");}}
				if(wn.length>0){if(r+wn[0][5]>minr&&r+wn[0][5]<maxr){
					nw=nw-offgx;nw=nw+p[mct+1].tierMaxResources.wood-p[mct].tierMaxResources.wood;
					cut();console.log("FFI Wood");}}
		}
		
		
		minr=0;maxr=2499;
	
		
		//RadialWeight = Math.Floor(1 + 10/(distanceFromBotBase + 0.01));
		//tempPressure = (Count + 1) * RadialWeight * (ownsLand ? HomeGroundWeight : 1);
        //Pressure = (int) Math.Floor(tempPressure);
	
		teWoodQ.sort(function(a,b){return a[7]-b[7]});
		
		//Aim This for round+ds%10==9 (So that I can arive before enemy can defend)
		
		//Offset all en nodes as well as 
			//Push all 11 own actions into a array
			//Push all 11 enemy actions into a array
				//Offset Nodes by actions
			
			//Hit last cycle ()
				//
				
				
		
	
		if(ma>0){
			for(i=0;i<teWoodQ.length;i++){
				
				radical = Math.floor(1 + 10/(teWoodQ[i][7] + 0.01));
				console.log("Radical Weight: "+radical);
				
				nu=Math.ceil(((teWoodQ[i][5]+1)/radical)-1);
				if(teWoodQ[i][4]>=nu){nu=nu-teWoodQ[i][4];}
				if(nu==0){nu=1;}
				
				console.log("NU: "+nu);
				
				if(nu<ma){m.actions.push({"type" : 11,"units" : nu,"id" : teWoodQ[i][2]});ma=ma-nu;   
								console.log("Details "+" x-"+teWoodQ[i][1]+" y-"+teWoodQ[i][0]);
								console.log("Try "+JSON.stringify({"type" : 11,"units" : nu,"id" : teWoodQ[i][2]}));
							   }
				}
		}
		//Cleanup Own TMWOOD Nodes
			for(i=0;i<tmWoodQ.length;i++){
				if(tmWoodQ[i][4]>0){
					
					m.actions.push({"type" : 12,"units" : tmWoodQ[i][4],"id" : tmWoodQ[i][2]});
					console.log("Found "+JSON.stringify({"type" : 12,"units" : tmWoodQ[i][4],"id" : tmWoodQ[i][2]}));
				}
			}
			//For Own
		
		//RadialWeight = (int) Math.Floor(1 + 10/(distanceFromBotBase + 0.01)); // todo: add these to the config	
	
	
		//Homeground weight: 1,1
		//Own Radical = 
	
	
		
		//Recall all units in own wood (if % 10 == 0)
	
	
		//Step 9: If still have units left here, Stockpile Heat for the future
		if(ma>0&&heatreq>0){
			
			if(bphase==3&&mwood<500000&&mct==4){nh=Math.floor((mw-p[mct+2].tierResourceConstraints.wood-3)/3*5);}
			else if(a>0||bphase<3||mwood<500000){nh=Math.floor((mw-p[mct+1].tierResourceConstraints.wood-3)/3*5);}
			else {nh=Math.floor((mw-3)/3*5);}
			
			burn();
			
		   cut();
		   }
		
		//Step 10: If I still have units left here, Fill Food storages (Only Endgame for the sake of Starve)
		if(ma>0&&r>2450){
			nf=(mf*-1);
			nf=nf+p[mct].tierMaxResources.food;
			
			for(k=fr.length-1;k>=0;k--){
				if(fr[k][1]==3){nf=nf-fr[k][3];}
				else {}
			}
			
			farm();
		}
		
		//1 Round delay on Farm Actions???
			//Maybe. If true, Lets patch
	
		//Territory Play here???
	
		//Step 11: If still have units left here, Allow any future farming
			////Loosen Future Farm maybe???
			//Allow return on 1 
		if(ma>0&&adv>0){
				//console.log("Attempting Next Future Farm if still have units: "+adv+" try "+ma+" units");
				minr=((cycle+adv+1)*10)+2;
				
				ng=ng-offgx;
				nw=nw-offgx;
				ns=ns-offgx;
			
				nw=nw+p[mct+1].tierMaxResources.wood-p[mct].tierMaxResources.wood;
				ns=ns+p[mct+1].tierMaxResources.stone-p[mct].tierMaxResources.stone;
				ng=ng+p[mct+1].tierMaxResources.gold-p[mct].tierMaxResources.gold;
				
				mineSN();
				mineGD();
				
				cut();
		}
		
		//Still have units left here??
			//Farm Everything thats left, Wood, Gold, Stone
			//Essentially I am the ruler of the lands and all I can do now is slow others down.
	
		
		//If still have Extra Units here... 
			//Just hit all Wood to lower enemy farm capacity. 
			//Add 500000 to my end farm and see how that ends for my Heat (Probably not best for 4v4, so check closely)
			//Maybe add an extra 500 000 to my own heat requirements...
			//Reason: If Im doing really well, adding more heat could be great. 
		
	//Set sabotage if still units left here instead.
		//Will destroy them by making sure they cannot get the wood they need...
		//Track enemy territory?
	
	//console.log("My Quadrent:"+quad);
	
	
	console.log("Tried to build:"+mbuild+" actually built:"+abuild);
	
	if(ma>0){
		console.log("Available Units left after: "+ma);
	}
	
	
	if(m!=""){
		connection.invoke("SendPlayerCommand", m);
		t1={"playerId" : bi,"actions" : []};
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
			nf=(mf*-1);nh=(mh*-1);ns=(mo*-1)-offs;ng=(mg*-1)-offg;nw=(mw*-1)-offw;
			for(k=fr.length-1;k>=0;k--){if(fr[k][1]==3){nf=nf-fr[k][3];}}
		}

function farm(){
	wf=0;
	for(i = 0; i<fn.length; i++){if(nf<1||ma<=0||starve){break;}
		if(r+fn[i][5]<minr||r+fn[i][5]>maxr){continue;}
		if(fn[i][1]==0||fn[i][3]==0){continue;}
		if(fn[i][3]>nf){wf=Math.ceil(nf/fn[i][2]);}
		else {wf=Math.ceil(fn[i][3]/fn[i][2]);}					 
		if(ma<wf){wf=ma;}
		if(fn[i][1]<wf){wf=fn[i][1];}					 
		if(wf>0){m.actions.push({"type" : 3,"units" : wf,"id" : fn[i][0]});ma=ma-wf;
							fn[i][3]=fn[i][3]-(wf*fn[i][2]);
							nf=nf-(wf*fn[i][2]);
				 			fn[i][1]=fn[i][1]-wf;
				}
	}
}


function cut(){
	ww=0;
	for(i = 0; i<wn.length; i++){if(nw<1||ma<=0){break;}
		if(r+wn[i][5]<minr||r+wn[i][5]>maxr){continue;}
		if(wn[i][1]==0||wn[i][3]==0){continue;}
		if(wn[i][3]>nw){ww=Math.ceil(nw/wn[i][2]);}
		else {ww=Math.ceil(wn[i][3]/wn[i][2]);}
		if(ma<ww){ww=ma;}
		if(wn[i][1]<ww){ww=wn[i][1];}
		if(ww>0){m.actions.push({"type" : 4,"units" : ww,"id" : wn[i][0]});ma=ma-ww;
				 			wn[i][3]=wn[i][3]-(ww*wn[i][2]);
							nw=nw-(ww*wn[i][2]);
				 			wn[i][1]=wn[i][1]-ww;
							}
	}
}


function mineSN(){
	ws=0;
	for(i = 0; i<sn.length; i++){if(ns<1||ma<=0){break;}
		if(r+sn[i][5]<minr||r+sn[i][5]>maxr){continue;}
		if(sn[i][1]==0||sn[i][3]==0){continue;}
		if(sn[i][3]>ns){ws=Math.ceil(ns/sn[i][2]);}
		else {ws=Math.ceil(sn[i][3]/sn[i][2]);}
		if(ma<ws){ws=ma;}
		if(sn[i][1]<ws){ws=sn[i][1];}					 
		if(ws>0){m.actions.push({"type" : 2,"units" : ws,"id" : sn[i][0]});ma=ma-ws;
				 			sn[i][3]=sn[i][3]-(ws*sn[i][2]);
							ns=ns-(ws*sn[i][2]);
				 			sn[i][1]=sn[i][1]-ws;
							}
		
	}
}

function mineGD(){
	wg=0;
	for(i = 0; i<gd.length; i++){if(ng<1||ma<=0){break;}
		if(r+gd[i][5]<minr||r+gd[i][5]>maxr){continue;}
		if(gd[i][1]==0||gd[i][3]==0){continue;}
		if(gd[i][3]>ng){wg=Math.ceil(ng/gd[i][2]);}
		else {wg=Math.ceil(gd[i][3]/gd[i][2]);}
		if(ma<wg){wg=ma;}
		if(gd[i][1]<wg){wg=gd[i][1];}					 
		if(wg>0){m.actions.push({"type" : 2,"units" : wg,"id" : gd[i][0]});ma=ma-wg;
				 			gd[i][3]=gd[i][3]-(wg*gd[i][2]);
							ng=ng-(wg*gd[i][2]);
				 			gd[i][1]=gd[i][1]-wg;
							}
		
	}
}


function burn(){
	wh=0;
	if(nh>0&&mw>=3&&ma>0&&r<2490&&heatreq>0){
		wh=Math.ceil(nh/5);
		if(wh*3>mw){wh=Math.floor(mw/3);}
		if(ma<wh){wh=ma;}
		m.actions.push({"type" : 5,"units" : wh,"id" : "00000000-0000-0000-0000-000000000000"});
		ma=ma-wh;
		nh=nh-(wh*5);
		heatreq=heatreq-(wh*5);
		mw=mw-(wh*3);
		nw=nw+(wh*3);
	}
}

function scout() {
	if(!sct){for(i = 0; i<s.length; i++){if(ma==0){break;}m.actions.push({"type" : 1,"units" : 1,"id" : s[i][0]});ma--;}}
}

//0,1 score for food or empty space
		//if score < 1 dont allow building.
		//Offset score, build towards center
		//check my quodrent and if x falls towards center, add 2 bonus points (if tp>1 already)
	//Build Phase 1

		//Ignore diagonal zone behind base.
		//That territory is out of reach of opponents, so I can grab them later, Better to fight for more central territory when the match starts

	//Run Variation where the back is merely penelized. 
		//Could created cases where it will still fix some problems in my builds
	
	//Impliment buildings as new marker...
		//Rework calcscore??
		//Test nb...


	//If build phase == 3 (Make sure I have my stone and Gold, Starve all from Stone and Gold)
		//Push Lumber
		//Choke out of Advancement???
var iq;
function calcScore(ti){
	tp=0;
	for(k=ty-ti;k<=ty+ti;k++){if(k<0||k>39){continue;}
			for(i=tx-ti;i<=tx+ti;i++){if(i<0||i>39||i==k){continue;}
				iq=false;
				if(quad=="SE"&&i-mx+k-my>-2){iq=true;}
				if(quad=="NW"&&mx-i+my-k>-2){iq=true;}	
				if(quad=="NE"&&i-mx+my-k>-2){iq=true;}	
				if(quad=="SW"&&mx-i+k-my>-2){iq=true;}				 
				
				if(bphase==1&&iq){continue;}	
									  
				t1=bt[k][i][0];
				np=0;
				if(t1=='F'||t1=='N'||t1=='W'||t1=='S'||t1=='G'){np=np+1;}		
				if(t1=='W'){np=np+1;}
				if(t1=='S'||t1=='G'){np=np+3;}
									  
				if(bphase==1&&iq){np=np/3;}	
				tp=tp+np;
			}	
		}
	
	if(tp<=ti*3){tp=0;}
	
	return tp;
}	
