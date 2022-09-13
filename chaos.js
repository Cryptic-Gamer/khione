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

var wcut=0;

var sct=false;

var en;
var heatreq, heatres;//Make sure this works

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
var fpop;

var mf, mw, mo, mh, mg; //Food, Wood, Stone, heat
var nf, nw, ns, nh, ng; //Need Food, Wood, Stone, Heat
var wf, ww, ws, wh, wg; //Worker food, wood, stone, heat
var tx, ty, tp, np, ttp, tb, tid; //Temp Territory vars, X, y, new points, points(score), temporary Points,building 
var starve, canstarve=false;;


var fr=[]; //Future Resources

var cycle=0;
var minr,maxr;

//just temp

var mbuild=0, abuild;
var cbuild;
var compfarm=false;

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
var bgain, bloss;

var quad="";
var sdist, gdist, wdist;	

//build Array - Building, amount modisfier, total cost, territory weight, size (according to the MT array), build time
build.push(['R', 1, 50, 35, 0, 1, 9, 2]);
build.push(['Q', 1, 90, 45, 0, 2, 25, 5]);
build.push(['F', 1, 50, 25, 0, 2, 25, 5]);
build.push(['O', 1, 220, 110, 0, 3, 49, 10]);
build.push(['L', 1, 40, 15, 0, 1, 9, 5]);

var t1, t2, t3, t4, t5, t6, tcomp; //temporary variables for performance boosts
var mwood, mstone, mgold, woodsup;

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

	var tmOuterBounds=[]; //Any enemy nodes outside of my own range (For cleanup)
	var teOuterBounds=[]; //All Enemy nodes out of Range (For Cleanup)

	var mz; //zone

	var tunits=0;

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
	
	if(adv>0){advr=((cycle+adv)*10)+1;}
	else {advr=5000;}
	
	heatreq=(mh*-1);
	
	for(i=cycle+1;i<250;i++){
		
		heatreq=heatreq+mp;
		t1=mp;
		if(mp<=30516){mp=Math.ceil(mp*1.05);}
		else {mp=Math.ceil(mp*1.03);}
		
		if(t1<50&&mp>50){mp=50;}
		if(t1<273&&mp>273){mp=273;}
		if(t1<1334&&mp>1334){mp=1334;}
		if(t1<6398&&mp>6398){mp=6398;}
		if(t1<30516&&mp>30516){mp=30516;}
		if(t1<145442&&mp>145442){mp=145442;}
	}
	heatreq=heatreq+(2*mp);
	
	mp=b[mid].population;
	
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
	//small offset for off = status multipliers
	fst=b[mid].statusMultiplier.foodReward;
	mst=b[mid].statusMultiplier.goldReward;
	wst=b[mid].statusMultiplier.woodReward;
	
	//console.log("Current Status Multipliers: fst="+fst+",mst="+mst+",wst="+wst);
	
	//Future Res: fr= id, action, units, total offset, type (stone or gold)
	sct=false;
	fr=[];
	for(i = 0; i<b[mid].actions.length; i++){
		tn=b[mid].actions[i];
		
		if(tn.actionType==1){sct=true;}
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
	
	fr.sort(function(a,b){return a[5]-b[5]});
	
	t=[]; //x, y, id, my pressure, my units, enemy pressure (best), enemy units (best), distance, myinb, mycomp, enemyinb, encomp
	en=[]; //x, y, id, my pressure, my units, enemy pressure (best), enemy units (best), distance, myinb, mycomp, enemyinb, encomp
	
	
	//console.log("My Borders:"+JSON.stringify(t));
	
	for(i = b.length-1; i>=0; i--){
		t1=b[i].territory;						   
		for(j = t1.length-1; j>=0; j--){
			
				ep=0;ec=0;myp=0;myc=0;
				t2=t1[j].occupants;
				for(k = t2.length-1; k>=0; k--){
					if(t2[k].botId==bi){myp=t2[k].pressure;myc=t2[k].count;}
					else {ep=t2[k].pressure;ec=t2[k].count;}
				}

				t3=0;
				tn=b[mid].actions;
				for(k = tn.length-1; k>=0; k--){
					if(tn[k].actionType==11&&tn[k].targetNodeId==t1[j].nodeOnLand){
						t3=t3+tn[k].numberOfUnits;
					}
				}

				if(b[i].id==bi){
					t.push([t1[j].y, t1[j].x, t1[j].nodeOnLand, myp, myc, ep, ec, bt[t1[j].y][t1[j].x][1], t3]);
				} else {					   
					en.push([t1[j].y, t1[j].x, t1[j].nodeOnLand, myp, myc, ep, ec, bt[t1[j].y][t1[j].x][1], t3]);
				} 
			}
		}
	
	//console.log("Enemy Borders:"+JSON.stringify(en));
	for(k=s.length-1;k>=0;k--){
		for(j=b[mid].map.scoutTowers.length-1;j>=0;j--){
			if(s[k][0]==b[mid].map.scoutTowers[j]){s.splice(k, 1);break;}
		}
	}
	
	
	//Rebuild Map Nodes
	wn=[];fn=[];sn=[];gd=[];

	for(j = w.map.nodes.length-1; j>=0; j--){
		tn=w.map.nodes[j];
		if(tn.amount<=100){bt[ty][tx][0]='T';continue;}
		
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
		
				if(t1=='N'||t1=='X'){bt[ty][tx][0]='E';}
				else if(t1=='W'){bt[ty][tx][0]='MW';}
				else if(t1=='F'||t1=='S'||t1=='G'){bt[ty][tx][0]='T';}
				else{}
				}
	
	//Update enemy territory on Map
	for(i = en.length-1; i>=0; i--){tx=en[i][1];ty=en[i][0];
					if(bt[ty][tx][0]=='N'||bt[ty][tx][0]=='E'){bt[ty][tx][0]='X';}
					if(bt[ty][tx][0]=='F'){bt[ty][tx][0]='EF';}
					if(bt[ty][tx][0]=='W'){bt[ty][tx][0]='EW';}
					if(bt[ty][tx][0]=='S'){bt[ty][tx][0]='ES';}
					if(bt[ty][tx][0]=='G'){bt[ty][tx][0]='EG';}
									
					for(j = nb.length-1; j>=0; j--){t1=nb[j][1];t2=nb[j][0];
													if(ty==t1&&tx==t2){
													   nb.splice(j, 1);console.log("Lost Building territory");mbuild--;break;
													   }
												   }
		} 
	
	
	
	for(j = nb.length-1; j>=0; j--){if(nb[j][7]<r){nb.splice(j, 1);}}
	
	//Update Enemy Buildings
	for(i = b.length-1; i>=0; i--){if(b[i].id==bi){continue;}
		for(j=b[i].buildings.length-1;j>=0;j--){
			t1=b[i].buildings[j];
				if(t1.type==6||t1.type==7||t1.type==8||t1.type==9||t1.type==10){bt[t1.position.y][t1.position.x][0]='EB';};
		}
	}
	
	mwood=0;
	mstone=0;
	mgold=0;
	woodsup=0;
	
	//Adjust Nodes for rewards (Own and Enemy)
	for(i = w.map.nodes.length-1; i>=0; i--){
						tn=w.map.nodes[i];
						
						t5=0;for(k=fr.length-1;k>=0;k--){if(tn.id==fr[k][0]){t5=t5+fr[k][2];}}
						t2=tn.currentUnits-t5;
						t4=Math.floor(tn.reward*0.7);	
		
						if(tn.type==1){
							
							for(j=wn.length-1;j>=0;j--){t1=wn[j];if(t1[0]==tn.id){
								t3=tn.reward+wst;
								
								if(bt[t1[7]][t1[6]][0]=='MW'){
									wn[j][2]=t3;
									wn[j][4]=Math.round(t3/bt[t1[7]][t1[6]][1] * 100) / 100;	
									wn[j][3]=tn.amount-(t5*t3)-(t2*t4);	
									if(wn[j][3]>=t3){mwood=mwood+wn[j][3];}
									}
								else if(bt[t1[7]][t1[6]][0]=='EW'){
									wn[j][2]=t4;
									wn[j][4]=Math.round(t4/bt[t1[7]][t1[6]][1] * 100) / 100;
									wn[j][3]=tn.amount-(t5*t4)-(t2*t4);	
									}
								else {
									wn[j][3]=tn.amount-(tn.currentUnits*tn.reward);
								}
								
								
								
							}woodsup=woodsup+wn[j][3];}
						} else if(tn.type==2){
							for(j=fn.length-1;j>=0;j--){t1=fn[j];if(t1[0]==tn.id){
								t3=tn.reward+fst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									fn[j][2]=t3;
									fn[j][4]=Math.round(t3/bt[t1[7]][t1[6]][1] * 100) / 100;	
									fn[j][3]=tn.amount-(t5*t3)-(t2*t4);	
									}
								else if(bt[t1[7]][t1[6]][0]=='EF'){
									fn[j][2]=t4;
									fn[j][4]=Math.round(fn[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;	
									fn[j][3]=tn.amount-(t5*t4)-(t2*t4);	
									}
								else {
									fn[j][3]=tn.amount-(tn.currentUnits*tn.reward);
								}
							}}
						} else if(tn.type==3){
							for(j=sn.length-1;j>=0;j--){t1=sn[j];if(t1[0]==tn.id){
								t3=tn.reward+mst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									sn[j][2]=t3;
									sn[j][4]=Math.round(sn[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;	
									sn[j][3]=tn.amount-(t5*t3)-(t2*t4);
									mstone=mstone+sn[j][3];
									}
								else if(bt[t1[7]][t1[6]][0]=='ES'){
									sn[j][2]=t4;
									sn[j][4]=Math.round(sn[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;		
									sn[j][3]=tn.amount-(t5*t4)-(t2*t4);	
									}	
								else {
									sn[j][3]=tn.amount-(tn.currentUnits*tn.reward);
								}
							}}
						} else {
							for(j=gd.length-1;j>=0;j--){t1=gd[j];if(t1[0]==tn.id){
								t3=tn.reward+mst;
								
								if(bt[t1[7]][t1[6]][0]=='T'){
									gd[j][2]=t4;
									gd[j][4]=Math.round(gd[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;	
									gd[j][3]=tn.amount-(t5*t3)-(t2*t4);	
									mgold=mgold+gd[j][3];
									}	
								else if(bt[t1[7]][t1[6]][0]=='EG'){
									gd[j][2]=t4;
									gd[j][4]=Math.round(gd[j][2]/bt[t1[7]][t1[6]][1] * 100) / 100;
									gd[j][3]=tn.amount-(t5*t4)-(t2*t4);	
									}
								else {
									gd[j][3]=tn.amount-(tn.currentUnits*tn.reward);
								}
							}}
						}
					}
	
	
	if(mwood==0&&mct>1&&!compfarm){
				console.log("Finished own wood Round:"+r+" total inactive units "+tunits);
				
				compfarm=true;
				}
	
	//Territory Vars Wood in Quadrant Own, 
	teWoodQ=[]; //Enemy Controled Wood in own Quadrent
	teWoodO=[]; //Enemy Wood Outer Quadrent
	teOtherQ=[]; //Enemy Territory Non Wood Own Q
	teOtherO=[]; //Enemy Territory Non Wood Outer Quadrent
	
	tmOuterBounds=[]; //All Own nodes out of Range of enemy (For Cleanup)
	teOuterBounds=[]; //All Enemy nodes out of Range (For Cleanup)
	
	//Populate Enemy Territory Zone Arrays
	for(i = en.length-1; i>=0; i--){tx=en[i][1];ty=en[i][0];t1=bt[ty][tx][0];
		if(t1=='EB'){
			if(en[i][4]>0&&ma>0){
				m.actions.push({"type" : 12,"units" : 1,"id" : en[i][2]});
				console.log("Found ENEMY BUILDING "+JSON.stringify({"type" : 12,"units" : 1,"id" : en[i][2]}));
				ma--;
			}
		continue;}	
		for(j = t.length-1; j>=0; j--){	t2=true;   
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
					 
					t2=false;break;
				} 
			}
			if(t2){teOuterBounds.push(en[i]);}						
		}
	
	
	//Defend if time...
	tmWoodQ=[]; //Own Wood in Own Quadrent
	tmWoodO=[]; //Own Wood Outer Quadrent
	tmOtherQ=[]; //Own Territory Non Wood Own Q
	tmOtherO=[]; //Own Territory Non Wood Outer Quadrent
	
	//Populate Own Territory Zone Arrays
	for(j = t.length-1; j>=0; j--){tx=t[j][1];ty=t[j][0];t1=bt[ty][tx][0];
		for(i = en.length-1; i>=0; i--){t2=true;
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
					
					t2=false;break;
				}	
			}
			if(t2){tmOuterBounds.push(t[j]);}			   
		}
	
	//Populate Own Territory Zone Arrays
	//console.log("teOuterBounds:"+JSON.stringify(teOuterBounds));
	//console.log("tmOuterBounds:"+JSON.stringify(tmOuterBounds));
	
	//Update Own territory
	for(j = t.length-1; j>=0; j--){
				tx=t[j][1];ty=t[j][0];
				t1=bt[ty][tx][0];if(t1!='MW'){continue;}
				bt[ty][tx][0]='T';
				}
	
	
	for(k=fr.length-1;k>=0;k--){
		for(j=wn.length-1;j>=0;j--){if(wn[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*wn[j][2];}}
		for(j=fn.length-1;j>=0;j--){if(fn[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*fn[j][2];}}
		for(j=sn.length-1;j>=0;j--){if(sn[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*sn[j][2];fr[k][4]='S';}}
		for(j=gd.length-1;j>=0;j--){if(gd[j][0]==fr[k][0]){fr[k][3]=fr[k][2]*gd[j][2];fr[k][4]='G';}}
	}
	
	
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
	
	//console.log("My Territorial Res left: W="+mwood+" S="+mstone+" G="+mgold);
	//console.log("Future Farm Vars:"+JSON.stringify(fr));

	//New Starve Function (Just work with the already existing heatreq)
	
	heatres=0;
	heatreq=heatreq-(Math.floor(mw/3)*5);
	
	//Add inbound wood to heatreq
	heatres=Math.floor(mwood/3)*5;
	
	starve=false;
	if((mp>30000||canstarve)&&heatreq>0){
		i=cycle;
		j=mp;
		t1=mf;
		t2=0;
		nh=mh+(Math.floor(heatres/3*5));
		for(i=cycle;i<250;i++){
			nh=nh-j;
			if(i>(249-t2)){starve=false;break;}
			if(nh<=0){starve=true;break;}
			if(t1>0){t1=t1-j;t2++;}
			t3=j;
			if(j<30516){j=Math.ceil(j*1.05);}
			else {j=Math.ceil(j*1.03);}
			
			if(t3<145442&&j>145442){j=145442;}
			}
		
		if(starve){
			canstarve=true;
		   console.log("Starve Status:"+starve+" should end:"+i+" offset:"+t2);
			console.log("State of Heat Requirements: heatreq: "+heatreq+" heat from wood reserves: "+heatres+" need "+(heatreq-heatres));
		   }
		
	}
	
	
	//Step 1: Try and get what I need to maintain population (Complete)
	if(ma>0){
		
		nf=(mf*-1);nh=(mh*-1);
		wcut=(mw*-1)+Math.ceil(mp*4*5/3);
		if(wcut<0){wcut=0;}
		nw=wcut;
		
		for(k=fr.length-1;k>=0;k--){if(fr[k][1]==3){nf=nf-fr[k][3];}}
		
		t1=0;
		nf=nf+mp;if(nf>0){t1=t1+nf;}
		nh=nh+mp;
		
		farm();
		burn();
		
		
			for(j=0;j<3;j++){if(ma<=0){break;}
					 
							 
				nf=nf+Math.ceil(mp/1.2);if(nf>0){t1=t1+nf;}
				nh=nh+Math.ceil(mp/0.9);
							 
				farm();		 
				burn();
				
			}
		
		wcut=nw;
		cut();
		if(nw>0){wcut=wcut-nw;}
		
		}
	
		//Step 3: Scout (Complete)
		scout();
		
		//Step 4 handle all food: Make sure I have enough food for next advancement (only if ADV near)
			//This tweak seems reasonable and could lower my onhand food requirements even further. Always best to try and push extra units down the funnel so other advancement strategies take preference.
		if(ma>0&&adv>0&&adv<=2){
			nf=nf+(p[mct+1].tierResourceConstraints.food-t1);if(nf>0){t1=t1+nf;}
			farm();
		}
		if(ma>0&&heatreq<0){
			nf=nf+(p[mct].tierMaxResources.food-t1);
			
			for(k=fr.length-1;k>=0;k--){
				if(fr[k][1]==3){nf=nf-fr[k][3];}
				else {}
			}
			
			farm();
		}
		
		//Step 5: Build for territory as best I can
		if(ma>0){
			
			//calculate building territory weights
			for(j = build.length-1; j>=0; j--){
				build[j][4]=((2*build[j][2])+build[j][3])*build[j][1]/build[j][6];
			}
			
			//Building Phase 1
			if(build[4][0]=='L'&&build[4][1]==1){canbuild=['L'];}
			else if(bphase==1){canbuild=['R', 'O', 'Q', 'F', 'L'];} //Fastest territory
			else if(bphase==2){canbuild=['O', 'Q', 'F', 'L'];}//Just Lumber, Farm Quarry //Cheapest territory
			else if(bphase==3){canbuild=['L'];}//Just lumber, No sort
			else {}
			
			if(bphase==1||bphase==2){
			//[tx,ty,tid,s1,s2,s3] (Each tile can have the best score for all building types then)
			mt=[];
			for(j = a.length-1; j>=0; j--){
				tx=a[j].position.x;
				ty=a[j].position.y;
				
				if(bt[ty][tx][1]>20){continue;}
				
				if(bt[ty][tx][0]=='T'){continue;}
				
				t2=0;t3=0;t4=0;
				
				tid=a[j].id;
				t2=calcScore(1);
				t3=calcScore(2);
				if(bphase==1){t4=calcScore(3);}
				if(t2+t3+t4>0){mt.push([tx,ty,tid,calcScore(1),calcScore(2),calcScore(3)]);}
			}
			
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
					tcomp=bt[ty][tx][1]+build[j][7]+r;
					
					wr=mw;gr=mg;sr=mo;
					
					for(k=fr.length-1;k>=0;k--){
						if(fr[k][5]<tcomp){
							if(fr[k][1]==4){wr=wr+fr[k][3];}
							else if(fr[k][1]==2){
								if(fr[k][4]=='S'){sr=sr+fr[k][3];}
								else {gr=gr+fr[k][3];}
							}
							else {}
							if(tcomp<advr){
								if(gr>p[mct].tierMaxResources.gold){gr=p[mct].tierMaxResources.gold;}
								if(wr>p[mct].tierMaxResources.wood){wr=p[mct].tierMaxResources.wood;}
								if(sr>p[mct].tierMaxResources.stone&&mct>0){sr=p[mct].tierMaxResources.stone;}
													
							} 	
							else{
									if(gr>p[mct+1].tierMaxResources.gold){gr=p[mct+1].tierMaxResources.gold;}
									if(wr>p[mct+1].tierMaxResources.wood){wr=p[mct+1].tierMaxResources.wood;}
									if(sr>p[mct+1].tierMaxResources.stone){sr=p[mct+1].tierMaxResources.stone;}
							}
						}
					}	
						
					for(k = nb.length-1; k>=0; k--){wr=wr-nb[k][4];sr=sr-nb[k][5];gr=gr-nb[k][6];}
					
					if(wr>t3*t2&&sr>=t3*t2&&gr>=t4*t2){mbuild++;
						
						//console.log("Trying:"+canbuild[i]+" End Vars: wr-"+wr+" t3*t2-"+(t3*t2)+" sr-"+sr+" t3*t2-"+(t3*t2)+" gr-"+gr+" t4*t2-"+(t4*t2));							  
														  
						bt[ty][tx][0]='T';

						nb.push([tx,ty,build[j][5],tid,t3*t2,t3*t2,t4*t2,tcomp]);
														  
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
		}
	
	//Minor Takeovers, anything under 2 Units
	
	
	//Simplified Stone (Rewrite 11 September 2022 after seeing the Matrix) Rebuilt the way I handle Stone, wood and gold. 
		//Applied that to buildings as well. Exposed so much other bugs in my code in the process. 
	
	if(ma>0&&sn.length>0){
		ns=mo;
		sdist=sn[0][5]+r;
		
		//Handle Buildings
		for(j = nb.length-1; j>=0; j--){if(nb[j][7]<sdist){ns=ns-nb[j][5];}}
		
		//future farmed res here
		for(k=fr.length-1;k>=0;k--){
						if(fr[k][5]<sdist&&fr[k][1]==2&&fr[k][4]=='S'){
							ns=ns+fr[k][3];
						}
					}
		
		if(sdist>advr){ns=p[mct+1].tierMaxResources.stone-ns;}
		else{ns=p[mct].tierMaxResources.stone-ns;}
	
		mineSN();
	}
	
	//Simplified Gold
	if(ma>0&&gd.length>0){
		ng=mg;
		gdist=gd[0][5]+r;
		
		for(j = nb.length-1; j>=0; j--){if(nb[j][7]<gdist){ng=ng-nb[j][6];}}
		
		//future farmed res here
		for(k=fr.length-1;k>=0;k--){
						if(fr[k][5]<gdist&&fr[k][1]==2&&fr[k][4]=='G'){
							ng=ng+fr[k][3];
						}
					}
		
		if(gdist>advr){ng=p[mct+1].tierMaxResources.gold-ng;}
		else{ng=p[mct].tierMaxResources.gold-ng;}
		
		mineGD();
	}	
	
	//Simplified Wood
	if(ma>0&&wn.length>0){
		nw=mw+wcut;
		wdist=wn[0][5]+r;
		
		for(j = nb.length-1; j>=0; j--){if(nb[j][7]<wdist){nw=nw-nb[j][4];}}
		
		//future farmed res here
		for(k=fr.length-1;k>=0;k--){
						if(fr[k][5]<wdist&&fr[k][1]==4){
							nw=nw+fr[k][3];
						}
					}
		
		if(wdist>advr){nw=p[mct+1].tierMaxResources.wood-nw;}
		else{nw=p[mct].tierMaxResources.wood-nw;}
				 
		cut();
	}	
	
		//Step 9: If still have units left here, Stockpile Heat for the future
		if(ma>0&&heatreq>0){
			
			//speedboost, offset allowed heat burn by amount of wood I will get in...
				//Too Dangerous... Gamble might be worth while...
			
			if(mct>=4&&bphase==3&&mwood<200000){nh=Math.floor((mw-p[6].tierResourceConstraints.wood-3)/3*5);}
			else if(adv>0){
				nh=Math.floor((mw-p[mct+1].tierResourceConstraints.wood-3)/3*5);
				//Allow burning through FR here...
			}
			else {nh=Math.floor((mw-3)/3*5);}
			
			for(j = nb.length-1; j>=0; j--){nh=nh-(Math.ceil((nb[j][4]-3)/3)*5);}
			
			burn();
			cut();
			
		   }
		
		//Still units Left, Do Territory	
		
		if(ma>0){
			
			console.log("Initiating Conquest with "+ma+" units");
			
			retreat();
			
			if(heatreq<0){console.log("Heat no longer matters");
						 
						 //Farm all wood on the map like crazy...
						 
						 }
			else if(heatreq<heatres+200000){
				console.log("DEFEND FOR YOUR LIFE");
				tmWoodQ.sort(function(a,b){return a[7]-b[7]});
				console.log("Wood in Own Quadrent, Defend"+JSON.stringify(teWoodQ));
				
				//Split remaining units between wood with amount > 0
				
				//<a
				
			} else {
				console.log("TAKE WHAT YOU NEED");
				
				teWoodQ.sort(function(a,b){return a[7]-b[7]});
				console.log("Enemy Wood in Own Quadrent (Retake)"+JSON.stringify(teWoodQ));
				
				//Step 1, take wood in own quadrent
				conquest(teWoodQ);
				
				//Step 2, take lands in my territory owned by enemy
				teOtherQ.sort(function(a,b){return a[7]-b[7]});	
				console.log("Enemy Lands in Own Quadrent (Retake)"+JSON.stringify(teOtherQ));
				conquest(teOtherQ);
			}
			
			if(ma>0){console.log("Still have "+ma+" units");}
			
		   }
		
	
	
	
	
		if(r%10==1){console.log("Population: "+mp);}
	
	if(r==2499){console.log("End Population:"+mp+" heatreq "+heatreq);}
	
	if(mbuild!=abuild+nb.length&&(r<1000||r==2499)){
		console.log("Tried to build:"+mbuild+" actually built:"+abuild+JSON.stringify(" Pending:"+JSON.stringify(nb)));
	}
	
	if(ma>0){
		console.log("Available Units left after: "+ma);
		tunits=tunits+ma;
	}
	
	if(m!=""&&r!=2500){
		
		connection.invoke("SendPlayerCommand", m);
		t1={"playerId" : bi,"actions" : []};
		if(m!=t1&&r<200){console.log(JSON.stringify(m));}
		
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
		if(ww>0){
			//if(bphase>0){ww++;}
			m.actions.push({"type" : 4,"units" : ww,"id" : wn[i][0]});ma=ma-ww;
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
		if(ws>0){
			//if(bphase>0){ws++;}
			m.actions.push({"type" : 2,"units" : ws,"id" : sn[i][0]});ma=ma-ws;
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
		if(wg>0){
			//if(bphase>0){wg++;}
			m.actions.push({"type" : 2,"units" : wg,"id" : gd[i][0]});ma=ma-wg;
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
				if(t1=='W'){np=np+1;if(bphase==2){np=np+2;}}
				if(t1=='S'||t1=='G'){np=np+3;if(bphase==2){np=np+3;}}
									  
				if(bphase==1&&iq){np=np/3;}	
				tp=tp+np;
			}	
		}
	
	if(tp<=ti*3){tp=0;}
	
	return tp;
}	

function conquest(target){
			for(i=0;i<target.length;i++){
				radical = Math.floor(1 + 10/(target[i][7] + 0.01));
				nu=Math.ceil(((target[i][5]+1)/radical)-1);
				if(nu==0){nu=1;}
				
				
				if(target[i][4]+target[i][8]>=nu){nu=nu-(target[i][4]+target[i][8]);}
				if(nu>0){console.log("Have "+ma+" Units need "+nu);}
				
				if(nu<=ma&&nu>0){m.actions.push({"type" : 11,"units" : nu,"id" : target[i][2]});ma=ma-nu; 
								 console.log("Attacking: "+target[i][2]+" with "+nu+" units");
							   }
				}
		}	

//Revised Retreat, 
	//When retreating always replace with 1 unit. This way the moment anyone retreats the land is mine by default. 
	//also set limits for things like base capture.
	//want to avoid overcomits on normal conquest...

function retreat(){
	for(i=t.length-1;i>=0;i--){if(t[i][4]>1&&t[i][6]==0&&ma>1){
		m.actions.push({"type" : 11,"units" : 1,"id" : t[i][2]});
		m.actions.push({"type" : 12,"units" : 1,"id" : t[i][2]});ma=ma-2;
		console.log("retreating own:"+t[i][2]+" replacing "+t[i][4]+" units with 1");
	}}
	for(i=en.length-1;i>=0;i--){if(en[i][4]>1&&en[i][6]==0&&ma>1){
		m.actions.push({"type" : 11,"units" : 1,"id" : en[i][2]});
		m.actions.push({"type" : 12,"units" : 1,"id" : en[i][2]});
		ma=ma-2;
		console.log("retreating enemy:"+en[i][2]+" replacing "+en[i][4]+" units with 1");//Unreasonable but can be tweaked to retreat a base that I lost...
		
	}}
}


//retreat function

//for normal bases, only take if need 1 unit... 
//save big numbers for wood... 


