import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import { interpolate } from 'd3';

export default function PatientDoseViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);

    useEffect(function draw(){
        if(svg !== undefined & props.svgPaths !== undefined & props.data != undefined){

            svg.selectAll('g').remove();
            svg.selectAll('path').remove();
            setPathsDrawn(false);

            var getColor = props.getColor;
            if(getColor === undefined){
                getColor = d3.interpolateReds;
            }

            let orient = props.orient;
            var paths = props.svgPaths[orient];
            let svgOrganList = Object.keys(paths);
            let organIdxs = svgOrganList.map(o => props.data.organList.indexOf(o)).filter(x => x > -1)
            let pathData = [];

            let maxDVal = 70;
            let minDVal = 0;
            //placehoder because I cant get stuff to work
            let plotVar = props.plotVar;
            let values = props.data[plotVar];
            // let scale =  Math.pow(.75,i);
            for(let organ of svgOrganList){
                let pos = props.data.organList.indexOf(organ);
                if(pos < 0){ continue; }
                let dVal = values[pos];
                //for if we're comparing to a certain patient, calculate dose difference
                if(props.baseline !== undefined){
                    dVal = dVal - props.baseline[plotVar][pos];
                }
                let path = paths[organ];
                let entry = {
                    // 'scale': scale,
                    'dVal': dVal,
                    // 'transform': 'scale('+scale+','+scale+')',
                    'organ_name': organ,
                    'plotVar': plotVar,
                    'path': path,
                }
                pathData.push(entry)
                if(dVal > maxDVal){ maxDVal = dVal; }
                if(dVal < minDVal){ minDVal = dVal; }
            }

            svg.selectAll('g').filter('.organGroup').remove();
            const organGroup = svg.append('g')
                .attr('class','organGroup');
            
            organGroup.selectAll('.organPath').remove();

            var colorScale;
            if(minDVal < 0){
                let maxExtent = Math.max(Math.abs(minDVal),Math.abs(maxDVal))
                colorScale = d3.scaleDiverging()
                    .domain([-maxExtent,0,maxExtent])
                    .range([1,.5,0])//inversing because the colorscale is green - white - blue but I want blue to be negative
            } else{
                colorScale = d3.scaleLinear()
                    .domain([0,maxDVal])
                    .range([0,1])
            }
            // console.log('colors',pathData.map(x=>colorScale(x.dVal)))
            const organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                // .attr('transform',(d,i)=>transforms[i])
                .attr('fill', x=>getColor(colorScale(x.dVal)))
                .attr('stroke','black')
                .attr('stroke-width','.1')
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.organ_name + '</br>' 
                        + d.plotVar + ': ' + d.dVal.toFixed(1) + '</br>'
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            setPathsDrawn(true)
        }
    },[props.data,svg,props.svgPaths,props.plotVar])

    // useEffect(function brushSelected(){
    //     if(svg !== undefined & pathsDrawn){
    //         //doing this the easy way with classes makes the positions wronge for some reason
    //         var isActive = d => (props.clusterOrgans.indexOf(d.organ_name) > -1);
    //         var inCue = d => (props.clusterOrganCue.indexOf(d.organ_name) > -1);
    //         function getStrokeWidth(d){
    //             if(d.scale == 1){
    //                 if(isActive(d)){
    //                     return .4;
    //                 } 
    //                 if(inCue(d)){
    //                     return .3;
    //                 } else{
    //                     return .1;
    //                 }
    //             } 
    //             return 0
    //         }
    //         function getStrokeColor(d){
    //             if(isActive(d) & inCue(d)){ return 'black';}
    //             if(isActive(d)){ return 'blue'; }
    //             if(inCue(d)){ return '#525252'; }
    //             return '#969696';
    //         }
    //         svg.selectAll('.organPath')
    //             .attr('stroke-width',getStrokeWidth)
    //             .attr('stroke',getStrokeColor)
    //             .on('contextmenu',function(e){
    //                 e.preventDefault();
    //                 let d = d3.select(this).datum();
    //                 let organ = d.organ_name;
    //                 props.addOrganToCue(organ);
    //             });

    //         //this also breaks it and I have no idea why because this is an obscure approach
    //         // svg.selectAll('.organPath').filter(d=>isActive(d)).raise();
    //     }
    // },[props.data,svg,pathsDrawn,props.clusterOrgans,props.clusterOrganCue])

    useEffect(()=>{
        if(svg !== undefined & pathsDrawn){
            console.log('drawing paths')
            let box = svg.node().getBBox();
            let transform = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            transform += ' scale(' + width/box.width + ',' + (-height/box.height) + ')';
            // console.log('transform',transform)
            svg.selectAll('g').attr('transform',transform);
        }
    },[props.data,svg,pathsDrawn]);

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}