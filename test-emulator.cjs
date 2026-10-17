// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 mb4umi
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const fields = {};
const document = {getElementById(id) {return fields[id] ??= {value:'',textContent:'',checkValidity:()=>true,addEventListener(event,fn){this[event]=fn;}};}};
const map = {setView(){return this;},panTo(){},on(){}};
const layer = {addTo(){return this;},clearLayers(){},setLatLng(){}};
const requests = [];
const context = vm.createContext({document,Date,Number,Math,JSON,Error,URL,setTimeout,clearTimeout,
 L:{map:()=>map,tileLayer:()=>layer,layerGroup:()=>layer,circleMarker:()=>layer,polyline:()=>layer},
 fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,status:200,text:async()=>'{"accepted":1}'};}});
vm.runInContext(script,context);
for(const [id,value] of Object.entries({timeMode:'now',trackingUrl:'https://raceradar.de/ingest/osmand?id=test',accuracy:'5',batt:'80',valid:'true',charge:'false'}))document.getElementById(id).value=value;
vm.runInContext("points=[{lat:50,lon:7,time:new Date('2026-07-25T10:00:00Z'),speed:18.52,distance:100,altitude:600,bearing:90}];",context);
(async()=>{
 const configLink='org.traccar.client://config?url=https%3A%2F%2Fraceradar.de%2Fingest%2Fosmand&id=test-id_with-dash&accuracy=highest&distance=0&interval=10&buffer=true&stop_detection=false';
 context.configLink=configLink;
 assert.equal(vm.runInContext("trackingTarget(configLink).searchParams.get('id')",context),'test-id_with-dash');
 fields.trackingUrl.value=configLink;
 vm.runInContext('urlSettings()',context);
 assert.equal(fields.configAccuracy.value,'highest');
 assert.equal(fields.speedSec.value,10);
 assert.throws(()=>vm.runInContext("trackingTarget('org.traccar.client://config?id=test')",context),/server URL/);
 assert.throws(()=>vm.runInContext("trackingTarget('org.traccar.client://config?url=https%3A%2F%2Fexample.com')",context),/Raceradar/);
 await vm.runInContext('send(0,true)',context);
 await vm.runInContext('send(0)',context);
 assert.equal(requests.length,2);
 assert.ok(requests[0].url.startsWith('https://raceradar.de/ingest/osmand?id=test-id_with-dash'));
 assert.equal(requests[0].data.alarm,'sos');
 assert.equal(requests[1].data.alarm,undefined);
 assert.equal(requests[1].data.speed,10);
 assert.equal(requests[1].data.batt,80);
 assert.ok(Math.abs(Date.now()-Date.parse(requests[1].data.timestamp))<2000);
 document.getElementById('timeMode').value='gpx';
 const historical=vm.runInContext('pointPayload(0,false)',context);
 assert.equal(historical.timestamp,'2026-07-25T10:00:00.000Z');
 vm.runInContext('points[0].time=null',context);
 assert.throws(()=>vm.runInContext('pointPayload(0,false)',context),/timestamp/);
 document.getElementById('trackingUrl').value='https://raceradar.de/ingest/osmand?id=test&accuracy=highest&interval=10&buffer=true';
 vm.runInContext('urlSettings()',context);
 assert.equal(fields.configAccuracy.value,'highest');
 assert.equal(fields.speedSec.value,10);
 vm.runInContext("points=[{lat:50,lon:7,time:new Date('2026-07-25T10:00:00Z'),distance:0},{lat:50.001,lon:7,time:new Date('2026-07-25T11:00:00Z'),distance:1000}];",context);
 document.getElementById('speed').value='36';
 assert.equal(vm.runInContext('playbackTimeline(10000)[1]',context),100000);
 document.getElementById('speed').value='72';
 assert.equal(vm.runInContext('playbackTimeline(10000)[1]',context),50000);
 vm.runInContext('playbackElapsed=50000',context);
 assert.equal(vm.runInContext('pointPayload(1,false).timestamp',context),'2026-07-25T10:00:50.000Z');
 document.getElementById('speed').value='';
 document.getElementById('speedSec').value='2';
 assert.equal(vm.runInContext('playbackTimeline(2000)[1]',context),3600000);
 vm.runInContext('points[1].time=null',context);
 assert.equal(vm.runInContext('playbackTimeline(2000)[1]',context),2000);
 const offsetDistance=vm.runInContext('geometry(points[0],noisyPosition(points[0],100,()=>0.81)).meters',context);
 assert.ok(Math.abs(offsetDistance-90)<0.001);
 assert.equal(vm.runInContext('noisyPosition(points[0],0).lat',context),50);
 for(const latitude of [-90,0,90]){
   const distance=vm.runInContext(`geometry({lat:${latitude},lon:179.999},noisyPosition({lat:${latitude},lon:179.999},100,()=>0.25)).meters`,context);
   assert.ok(Number.isFinite(distance)&&distance<=100.01);
 }
 document.getElementById('timeMode').value='now';
 document.getElementById('noise').value='100';
 const noisy=vm.runInContext('pointPayload(1,false)',context);
 assert.notEqual(noisy.lat,50.001);
 assert.equal(vm.runInContext('points[1].lat',context),50.001);
 // 36 km/h, ten-meter GPX spacing, ten-second sending interval: skip 9 points.
 vm.runInContext('points=Array.from({length:31},(_,i)=>({lat:50+i/10000,lon:7,distance:i*10,time:new Date(100000+i*1000)}))',context);
 document.getElementById('speed').value='36';
 const timeline=vm.runInContext('playbackTimeline(10000)',context);
 assert.equal(timeline[30],30000);
 for(const [elapsed,expected] of [[0,0],[10000,10],[20000,20],[30000,30],[35000,30]]){
  context.elapsed=elapsed;
  assert.equal(vm.runInContext('playbackIndex(playbackTimeline(10000),elapsed)',context),expected);
 }
 document.getElementById('speed').value='72';
 assert.equal(vm.runInContext('playbackIndex(playbackTimeline(10000),10000)',context),20);
 assert.equal(vm.runInContext('nextSendAt(0,0,2000,10000)',context),10000);
 assert.equal(vm.runInContext('nextSendAt(0,0,25000,10000)',context),30000);
 assert.equal(vm.runInContext('nextSendAt(0,12000,13000,10000)',context),22000);
 vm.runInContext('running=true;busy=false;pendingSos=false',context);
 document.getElementById('sosBtn').click();
 assert.equal(vm.runInContext('pendingSos',context),true);
 assert.equal(requests.length,2); // Queue SOS rather than sending outside the interval.
 vm.runInContext('stop()',context);
 vm.runInContext('selectStart(10)',context);
 assert.equal(vm.runInContext('startIndex',context),10);
 assert.equal(vm.runInContext('playbackTimeline(10000)[10]',context),0);
 assert.equal(vm.runInContext('playbackIndex(playbackTimeline(10000),10000)',context),30);
 assert.equal(vm.runInContext('nearestPoint({lat:50.0011,lon:7})',context),11);
 document.getElementById('timeMode').value='gpx';
 vm.runInContext('playbackElapsed=5000',context);
 assert.equal(vm.runInContext('pointPayload(10,false).timestamp',context),new Date(115000).toISOString());
 vm.runInContext('running=true;selectStart(0)',context);
 assert.equal(vm.runInContext('startIndex',context),10);
 vm.runInContext('stop();selectStart(0)',context);
 assert.equal(vm.runInContext('startIndex',context),0);
 assert.ok(html.includes('id="trackingUrl" type="text"'));
 vm.runInContext('points=[{lat:0,lon:0,distance:0,time:new Date(100000)},{lat:0,lon:0.0008,distance:90,time:new Date(110000)}];loopState()',context);
 assert.equal(vm.runInContext('loopEligible()',context),true);
 assert.equal(fields.loop.disabled,false);
 fields.loop.value='on';
 vm.runInContext('points[1].lon=0.001;loopState()',context);
 assert.equal(vm.runInContext('loopEligible()',context),false);
 assert.equal(fields.loop.value,'off');
 assert.equal(fields.loop.disabled,true);
 vm.runInContext('points[1].lon=100/6371000*180/Math.PI',context);
 assert.equal(vm.runInContext('loopEligible()',context),false); // Strictly below 100 m.
 fields.speed.value='';
 vm.runInContext('points[1].lon=0.0008;startIndex=1',context);
 assert.equal(vm.runInContext('playbackTimeline(10000,0)[0]',context),0);
 assert.equal(vm.runInContext('playbackTimeline(10000,0)[1]',context),10000);
 fields.loop.value='on';fields.timeMode.value='gpx';fields.speed.value='';
 vm.runInContext('playbackElapsed=20000',context);
 assert.equal(vm.runInContext('pointPayload(0,false).timestamp',context),new Date(130000).toISOString());
 let clock=100000;const scheduled=[];
 context.Date=class extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 context.setTimeout=(callback,delay)=>{scheduled.push({callback,at:clock+delay});return scheduled.length;};context.clearTimeout=()=>{};
 vm.runInContext('startIndex=0;points=[{lat:0,lon:0,distance:0,time:new Date(100000)},{lat:0,lon:0.00001,distance:1,time:new Date(101000)}]',context);
 fields.speed.value='36';fields.speedSec.value='1';fields.noise.value='0';fields.loop.value='on';fields.timeMode.value='now';
 const baseline=requests.length;
 fields.startBtn.click();await new Promise(resolve=>setImmediate(resolve));
 for(let i=0;i<3;i++){const task=scheduled.shift();assert.ok(task);clock=task.at;await task.callback();}
 assert.equal(requests.length-baseline,4);
 assert.deepEqual(requests.slice(baseline).map(request=>request.data.lon),[0,0.00001,0,0.00001]);
 assert.deepEqual(requests.slice(baseline).map(request=>Date.parse(request.data.timestamp)),[100000,101000,102000,103000]);
 assert.equal(vm.runInContext('running',context),true);
 vm.runInContext('stop()',context);
 // JSON imports sort each device and preserve source measurements.
 const synthetic=[];
 for(let device=0;device<3;device++)for(const second of [5,0,2])synthetic.push({device_id:`device-${device}`,measured_at:new Date(100000+second*1000).toISOString(),latitude:50+device/100,longitude:7+second/10000,accuracy_m:12+device});
 context.exportRows=synthetic;
 assert.equal(vm.runInContext('parseDeviceExport(exportRows).size',context),3);
 assert.equal(vm.runInContext("parseDeviceExport(exportRows).get('device-0')[0].time.getTime()",context),100000);
 assert.throws(()=>vm.runInContext('parseDeviceExport([{device_id:"x",latitude:91,longitude:7,measured_at:"bad"}])',context),/coordinates/);
 vm.runInContext('jsonDevices=parseDeviceExport(exportRows)',context);
 for(let i=0;i<3;i++){document.getElementById(`jsonId${i}`).value=`device-${i}`;document.getElementById(`jsonUrl${i}`).value=`https://raceradar.de/ingest/osmand?id=target-${i}`;}
 fields.jsonInterval.value='1';fields.jsonFactor.value='10';fields.jsonTimeMode.value='now';fields.noise.value='0';
 document.getElementById('jsonUrl1').value=document.getElementById('jsonUrl0').value;
 assert.throws(()=>vm.runInContext('jsonChannels()',context),/different destination tracking ID/);
 document.getElementById('jsonUrl1').value='https://raceradar.de/ingest/osmand?id=target-1';
 clock=200000;scheduled.length=0;
 const jsonRequests=[],releases=[];
 context.fetch=(url,options)=>new Promise(resolve=>{jsonRequests.push(JSON.parse(options.body));releases.push(()=>resolve({ok:true,status:200,text:async()=>'{"accepted":1}'}));});
 fields.jsonUrl0.value='org.traccar.client://config?url=https%3A%2F%2Fraceradar.de%2Fingest%2Fosmand&id=target-0&interval=10';
 fields.jsonStart.click();
 assert.equal(jsonRequests[0].url,'https://raceradar.de/ingest/osmand?id=target-0&interval=10');
 assert.equal(jsonRequests.length,3); // All three start before any response resolves.
 assert.deepEqual(jsonRequests.map(r=>r.data.accuracy),[12,13,14]);
 assert.ok(jsonRequests.every(r=>r.data.timestamp===new Date(200000).toISOString()));
 releases.splice(0).forEach(release=>release());await new Promise(resolve=>setImmediate(resolve));
 const jsonTick=scheduled.shift();clock=jsonTick.at;const tickPromise=jsonTick.callback();
 assert.equal(jsonRequests.length,6);
 assert.ok(jsonRequests.slice(3).every(r=>r.data.lon===7.0005)); // Intermediate 2-second sample dropped.
 assert.ok(jsonRequests.slice(3).every(r=>r.data.timestamp===new Date(200500).toISOString()));
 releases.splice(0).forEach(release=>release());await tickPromise;
 assert.equal(vm.runInContext('jsonRunning',context),false);
 assert.equal(scheduled.length,0);
 if(process.argv[2]){context.realExport=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));assert.equal(vm.runInContext('parseDeviceExport(realExport).size',context),3);}
 // Speed variation changes both sent speed and progress, without changing the interval.
 assert.equal(vm.runInContext('variationSpeed(30,10,60,15000)',context),40);
 assert.equal(vm.runInContext('variationSpeed(30,10,60,45000)',context),20);
 assert.equal(vm.runInContext('variationSpeed(10,20,60,45000)',context),0);
 assert.equal(vm.runInContext('variationDistance(36,0,60,0,10000)',context),100);
 assert.ok(Math.abs(vm.runInContext('variationDistance(36,18,4,0,4000)',context)-40)<0.01);
 assert.ok(vm.runInContext('variationDistance(10,20,60,0,60000)',context)>10/3.6*60);
 clock=300000;scheduled.length=0;
 context.Math=Object.create(Math);context.Math.random=()=>0;
 const waveRequests=[];
 context.fetch=async(url,options)=>{waveRequests.push(JSON.parse(options.body));return {ok:true,status:200,text:async()=>'{"accepted":1}'};};
 vm.runInContext('points=Array.from({length:101},(_,i)=>({lat:50,lon:7+i/100000,distance:i,time:new Date(100000+i*1000)}));startIndex=0',context);
 fields.speed.value='36';fields.speedAmplitude.value='18';fields.speedPeriod.value='4';fields.speedSec.value='1';fields.timeMode.value='now';fields.loop.value='off';
 fields.startBtn.click();await new Promise(resolve=>setImmediate(resolve));
 for(let i=0;i<4;i++){const task=scheduled.shift();clock=task.at;await task.callback();}
 assert.deepEqual(waveRequests.map(r=>Date.parse(r.data.timestamp)),[300000,301000,302000,303000,304000]);
 assert.deepEqual(waveRequests.map(r=>r.data.distance),[0,13,26,33,40]);
 assert.ok(Math.abs(waveRequests[1].data.speed*1.852-54)<1e-9);
 assert.ok(Math.abs(waveRequests[3].data.speed*1.852-18)<1e-9);
 vm.runInContext('stop()',context);
 assert.ok(html.indexOf('<h2>JSON')>html.indexOf('<h2>Measurements'));
 assert.ok(html.includes('<html lang="en">'));
 console.log('OK: sine speed variation, integrated progress, fixed send cadence, English UI, JSON below measurements, parallel JSON devices, sorted import, ID/URL routing, source accuracy, retimed timestamps, dropped samples, completion, repeated loops at fixed intervals, loop distance threshold, loop timeline/timestamps, map start selection, relative timeline, selected historical origin, reset, interval sampling, skipped points, fast forward, slow responses without catch-up bursts, queued SOS, timestamps and noise');
})().catch(err=>{console.error(err);process.exitCode=1;});
