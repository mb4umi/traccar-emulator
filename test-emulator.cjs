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
 await vm.runInContext('send(0,true)',context);
 await vm.runInContext('send(0)',context);
 assert.equal(requests.length,2);
 assert.equal(requests[0].data.alarm,'sos');
 assert.equal(requests[1].data.alarm,undefined);
 assert.equal(requests[1].data.speed,10);
 assert.equal(requests[1].data.batt,80);
 assert.ok(Math.abs(Date.now()-Date.parse(requests[1].data.timestamp))<2000);
 document.getElementById('timeMode').value='gpx';
 const historical=vm.runInContext('pointPayload(0,false)',context);
 assert.equal(historical.timestamp,'2026-07-25T10:00:00.000Z');
 vm.runInContext('points[0].time=null',context);
 assert.throws(()=>vm.runInContext('pointPayload(0,false)',context),/Zeitstempel/);
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
 console.log('OK: map start selection, relative timeline, selected historical origin, reset, interval sampling, skipped points, fast forward, slow responses without catch-up bursts, queued SOS, timestamps and noise');
})().catch(err=>{console.error(err);process.exitCode=1;});
