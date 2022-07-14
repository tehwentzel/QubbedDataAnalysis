import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import {forceSimulation,forceCollide,forceX,forceY, interpolatePiYG} from 'd3';
export default function RuleViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pointData,setPointData] = useState();
    const [pathData,setPathData] = useState();
    const [dotsDrawn,setDotsDrawn] = useState(false);
    const outcomeDates = [13,33];
    const xMargin = 20;
    const yMargin = 10;
    
    const xLabelSize = 9;
    const R = (props.rule === undefined)? 3.5: 6/(1+props.rule.features.length**.5);
    const yPadding = 20*R;
    const splitAxes = false;
    const oThreshold = props.ruleThreshold;
    const isActive = (d) => parseInt(d.id) == parseInt(props.selectedPatientId);

    //if ther rules are predicting a cluster, use cluster color + grey
    //otherwise use red + blueish (adjusted to make seeing the outlines easier)
    const targetIsCluster = (props.ruleTargetCluster !== undefined & props.ruleTargetCluster >= 0);
    const targetColor = targetIsCluster? props.categoricalColors(props.ruleTargetCluster):'red';
    const nonTargetColor = targetIsCluster? '#D8D8D8':'#2166ac';
    
    
    function getSplitParts(fname){
        if(fname.includes('_limit')){
            return [fname, ''] 
        } else if(fname.includes('mean_dose_')){
            let feature = 'mean_dose';
            let organ = fname.replace('mean_dose_','');
            return [feature,organ];
        } else if(fname.includes('max_dose')){
            let feature = 'max_dose';
            let organ = fname.replace('max_dose_','');
            return [feature,organ];
        }
        else{
            let [feature, ...organ] = fname.split('_');
            organ = organ.join('_')
            return [feature,organ];
        }
    }
    function makeAccessor(fName,oList){
        let [feature, organ] = getSplitParts(fName);
        if(organ !== ''){
            let fPos = oList.indexOf(organ);
            let accessor = null;
            if(fPos >= 0){
                accessor = d => {
                    let f = d[feature];
                    if(f === undefined){return -1}
                    return f[fPos];
                };
            }
            return accessor
        } 
        //special case for pre-define split rules 
        //should be 0 or 1 with threshold of .5, scaled so it plots better
        else{
            return d=>(d[feature] > 0)? .8:.2;
        }
        
    }
    function getSymptomOutcome(d){
        let dateIdxs = outcomeDates.map(i => d.dates.indexOf(i));
        let sVals = d['symptoms_'+props.mainSymptom];
        let maxS = 0;
        for(let didx of dateIdxs){
            if(sVals[didx] !== undefined){
                maxS = Math.max(maxS,sVals[didx]);
            }
        }
        return parseInt(maxS);
    }


    useEffect(function draw(){
        if( Utils.allNotUndefined([svg,props.svgPaths,props.rule,props.doseData]) ){
            const organList = props.doseData[0].organList;
            const nFeatures = props.rule.features.length;
            const rFeatures = props.rule.features;
            const stepWidth = (width-2*xMargin)/(nFeatures+1);
            const lineFunc = d3.line();
            const curveFunc = d3.curveBasis();
            const yRange = [height-yMargin-xLabelSize-yPadding,yMargin+yPadding];
            const inTop = (d) => (props.rule.upper_ids.indexOf(d.id) >= 0);
            const inBottom = (d) => (props.rule.lower_ids.indexOf(d.id) >= 0);
            const inTargetClass = (d) => (props.rule.target_ids.indexOf(d.id) >= 0);
            const validPatient = (d) => {
                return (inTop(d) | inBottom(d))
            }
            let doseData = props.doseData.filter(validPatient)

            let getX = (feat) => {
                let idx = rFeatures.indexOf(feat);
                if(feat === 'outcome'){
                    idx = rFeatures.length;
                } 
                let x = (idx + .5)*stepWidth;
                return x;
            }
            let splitData = [];
            for(let i in rFeatures){
                let fName = rFeatures[i];
                let threshold = props.rule.thresholds[i];
                let accessor = makeAccessor(fName,organList);
                let [feature,organ] = getSplitParts(fName,organList);
                if(accessor !== null){
                    let extents = d3.extent(doseData, accessor);
                    let getY = d3.scaleLinear()
                        .domain([0,extents[1]])
                        .range(yRange);
                    let fX = getX(fName);
                    let axisPoints = [
                        [fX,yRange[0]+yPadding],
                        [fX,yRange[1]-yPadding],
                    ]
                    let splitEntry = {
                        'feature': feature,
                        'organ': organ,
                        'name': fName,
                        'accessor': accessor,
                        'getY': getY,
                        'x': fX,
                        'max': extents[1],
                        'min': extents[0],
                        'threshold': threshold,
                        'thresholdY': getY(threshold),
                        'path': lineFunc(axisPoints),
                    }
                    splitData.push(splitEntry);
                }
                
            }

            const finalYScale = d3.scaleLinear()
                .domain([0,nFeatures])
                .range([yRange[0]-(yPadding/4),yRange[1]+(yPadding/4)]);

            const finalX = getX('outcome');
            let finalSplitEntry = {
                'feature': 'group',
                'organ': 'split',
                'name': 'split-group',
                'x': finalX,
                'threshold': nFeatures,
                'thresholdY': finalYScale(nFeatures-.5),
                'path': lineFunc([[finalX,yRange[0]+yPadding],[finalX,yRange[1]-yPadding]])
            }
            splitData.push(finalSplitEntry);
            splitData.sort((a,b) => a.x - b.x);
            var patientDots = [];
            var patientPaths = [];
            
            for(let p of doseData){
                let pathPoints = [];
                let tempDots = [];
                let inGroup = true;
                let numSplits = 0;
                let sVal = getSymptomOutcome(p);
                for(let split of splitData){
                    if(!inGroup | split.name =='split-group'){ continue; }
                    let pVal = split.accessor(p);
                    let x = split.x;
                    if(splitAxes & (sVal >= oThreshold)){
                        x += 1*R;
                    } else{
                        x -= 1*R;
                    }
                    let y= split.getY(pVal);
                    pathPoints.push([x,y]);
                    let dotEntry = {
                        'x': x,
                        'y': y,
                        'aboveThreshold': (sVal > oThreshold),
                        'baseX': x,
                        'baseY': y,
                        'axisX': split.x,
                        'value': pVal,
                        'organ': split.organ,
                        'name': split.name,
                        'targetClass': inTargetClass(p),
                        'id': p.id,
                        'outcome':sVal,
                    }
                    if(pVal >= split.threshold & inGroup){
                        numSplits += 1
                    } else{
                        inGroup = false;
                    }
                    tempDots.push(dotEntry);
                }

                let oX = getX('outcome');
                let oY = finalYScale(numSplits)
                let finalDot = {
                    'x': oX,
                    'y': oY,
                    'baseX': oX,
                    'baseY': oY,
                    'axisX': oX,
                    'value': numSplits,
                    'organ': props.mainSymptom,
                    'name': props.mainSymptom + '_' + oThreshold,
                    'feature': oThreshold,
                    'id': p.id,
                    'targetClass': inTargetClass(p),
                    'aboveThreshold': (sVal > oThreshold),
                    'outcome': sVal,
                }
                tempDots.push(finalDot);
                pathPoints.push([oX,oY]);
                let lineEntry = {
                    'points':pathPoints,
                    'path': lineFunc(pathPoints),
                    'id': p.id,
                    'inGroup': inGroup,
                    'outcome':sVal,
                    'targetClass': inTargetClass(p),
                }
                patientPaths.push(lineEntry);
                for(let e of tempDots){
                    e.inGroup = inGroup;
                    patientDots.push(e);
                }
            }

            svg.selectAll('path').filter('.axisLine').remove();
            let axes = svg.selectAll('path').filter('.axisLine')
                .data(splitData).enter()
                .append('path').attr('class','axisLine')
                .attr('d',d=>d.path)
                .attr('stroke','black')
                .attr('stroke-width',3)
                .attr('stroke-opacity',.5);

            const makeLabel = (d) => {
                let organ = d.organ + '';
                organ = organ.replace('t_','').replace('_','');
                organ = organ.substring(0,4);
                let string = organ + '-' + d.feature.replace('_dose','')
                string += ' >' + d.threshold;
                return string;
            }
            svg.selectAll('text').filter('.labelText').remove();
            svg.selectAll('text').filter('.labelText')
                .data(splitData).enter()
                .append('text').attr('class','labelText')
                .attr('x',d=>d.x)
                .attr('text-anchor','middle')
                .attr('y',yRange[0]+xLabelSize+yPadding)
                .attr('font-size',xLabelSize)
                .html(makeLabel);

            const [tRectW, tRectH] = [width/(2+nFeatures),2]
            svg.selectAll('rect').filter('.thresholdRect').remove();
            let rects = svg.selectAll('rect').filter('.thresholdRect')
                .data(splitData).enter()
                .append('rect').attr('class','thresholdRect')
                .attr('x',d=> d.x - tRectW/2)
                .attr('y',d=> d.thresholdY - tRectH/2)
                .attr('width',tRectW)
                .attr('height',tRectH)
                .attr('fill','black')
            
            setPointData(patientDots);
            if(patientPaths.length > 0){
                setPathData(patientPaths);
            }
            
        }
    },[props.data,svg,props.svgPaths,props.plotVar])

    useEffect(function drawDots(){
        if(pointData !== undefined & svg !== undefined){
            svg.selectAll('circle').filter('.patientCircle').remove();
            setDotsDrawn(false);
            let dots = svg.selectAll('circle').filter('.patientCircle')
                .data(pointData).enter()
                .append('circle').attr('class','patientCircle')
                .attr('cx', d=>d.x)
                .attr('cy',d=>d.y)
                .attr('fill',d=>d.targetClass? targetColor:nonTargetColor)
                .attr('stroke', d => d.aboveThreshold? 'black':'white')
                .attr('stroke-width', d => d.aboveThreshold? .7*R:0.1*R)
                .attr('opacity', .9)
                .attr('r',R);

            function boundX(d){
                let bx = Math.max(R, Math.min(width-R, d.x));
                if(splitAxes){
                    if(d.outcome >= oThreshold){
                        bx = Math.max(d.axisX+R,bx);
                    } else{
                        bx = Math.min(d.axisX-R,bx);
                    }
                }
                return bx;
            }
            function boundY(d){return Math.max(R+yMargin, Math.min(height-xLabelSize-yMargin-R, d.y))}
            var ticked = (d)=>{
                dots.attr('cx',d=>boundX(d))
                    .attr('cy',d=>boundY(d));
            }
            var simulation = forceSimulation(pointData)
                .force('collide',forceCollide().radius(.1+R).strength(1.2))
                .force('x',forceX(d=>d.baseX).strength(.05))
                .force('y',forceY(d=>d.baseY).strength(.05))
                .alphaMin(.05)
                .on('tick',ticked)
                .on('end',()=>{
                    dots.on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = 'patient: ' + d.id + '</br>' 
                            + d.organ + '-' + d.name + ':' + d.value + '</br>'
                            + props.mainSymptom + ': ' + d.outcome + '</br>'
                            + 'in target group: ' + d.targetClass +'</br>';
                        tTip.html(tipText);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    });
                    setDotsDrawn(true);
                });
        }
    },[svg,pointData]);

    useEffect(function drawLines(){
        
        if(pathData !== undefined & svg !== undefined){
            svg.selectAll('path').filter('.patientLine').remove();
            let plines = svg.selectAll('path').filter('.patientLine')
                .data(pathData).enter()
                .append('path').attr('class','patientLine')
                .attr('d',d=>d.path)
                .attr('stroke',d=>(d.targetClass)? targetColor:nonTargetColor)
                .attr('stroke-width',1)
                .attr('fill','none')
                .attr('stroke-opacity', .2);
            svg.selectAll('.patientCircle').raise();
            svg.selectAll('.thresholdRect').raise();
        }
    },[svg,pathData])

    // useEffect(function brush(){
    //     if(!dotsDrawn | svg === undefined){return}
    //     let dots = svg.selectAll('circle')
    //     dots.attr('stroke-width',d=>isActive(d)? R:.01)
    //         .attr('opacity', (d) => isActive(d)? 1: .7)
    //         .attr('stroke',d=>isActive(d)? 'black':'grey')
    //         .on('dblclick',function(e){
    //             let d = d3.select(this).datum();
    //             if(d === undefined){ return; }
    //             let pid = parseInt(d.id);
    //             if(pid !== props.selectedPatientId){
    //                 props.setSelectedPatientId(pid);
    //             }
    //         })
    // },[svg,props.selectedPatientId,dotsDrawn])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}