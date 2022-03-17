import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import Dose2dCenterViewD3 from './Dose2dCenterViewD3.js';

export default function ClusterSymptomsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [drawn, setDrawn] = useState(false);

    const plotSymptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis']
    const minWeeks = 33;
    const maxWeeks = -1;


    const thresholds = [5,7,9]
    const categoricalColors = d3.scaleOrdinal(d3.schemePaired);
    const getThresholdColor = x => d3.interpolateBlues(x/thresholds[thresholds.length-1]);

    const angleIncrement = 2*Math.PI/plotSymptoms.length;
    
    const margin = 10;
    const radius = Math.min(height/2 - margin,width/2 - margin);
    const valueRange = [0,1];
    const scaleTransform = x => x**.25;

    function significanceColor(p,odds){
        if(p > .05 | odds < 1){
            return '#af8dc3';
        } else if(p > .01){
            return '#d94801'
        } else{
            return '#8c2d04'
        }
    }

    function pol2rect(r, θ) { 
        let x = r*Math.cos(θ) + width/2;
        let y = r*Math.sin(θ) + height/2;
        return [x,y];
    }
    function coordinateTransform(sname,value){
        let angle = plotSymptoms.indexOf(sname)*angleIncrement;
        let r = radius*value/valueRange[1];
        return pol2rect(r,angle)
    }

    useEffect(function drawAxes(){
        if(svg !== undefined){
            // console.log('drawing axes')
            const axLineFunc = d3.line()
                .x(d => d[0])
                .y(d => d[1]);
    
            svg.selectAll('.axisGroup').exit().remove();
            var axisGroup = svg.append('g').attr('class','axisGroup');
            var axisPaths = [];
            var endpoints = []
            for(let symptom of plotSymptoms){
                let [x0,y0] = coordinateTransform(symptom,0);
                let [x1,y1] = coordinateTransform(symptom,valueRange[1]);
                let axPath = axLineFunc([[x0,y0],[x1,y1]]);
                axisPaths.push({
                    'path': axPath,
                    'symptom': symptom,
                });
                endpoints.push({
                    'x': x1,
                    'y': y1,
                    'symptom': symptom,
                });
            }

            axisGroup.selectAll('path')
                .data(axisPaths).enter()
                .append('path')
                .attr('class','axisLine')
                .attr('d',d=>d.path)
                .attr('stroke-width',.5)
                .attr('stroke','grey');

            axisGroup.selectAll('circle')
                .data(endpoints).enter()
                .append('circle')
                .attr('class','axisEndpoint')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',3)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.symptom;
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });
        }
    },[svg,height,width])

    useEffect(function draw(){
        
        if(svg !== undefined & props.data != undefined & height > 0 & width > 0){
            svg.selectAll('g').filter('.symptomCurveGroup').remove();
            var curveGroup = svg.append('g').attr('class','symptomCurveGroup')
            setDrawn(false);
            let curvePoints = [];
            let curveEndpoints = [];
            let minDateIdx = props.data.dates.indexOf(minWeeks);
            let maxDateIdx = props.data.dates.length;
            if(maxWeeks > 0){
                let maxDateIdx = props.data.dates.indexOf(maxWeeks)
            }
            for(let threshold of thresholds){
                let tColor = getThresholdColor(threshold)
                let tholdEntry = {
                    'color': tColor,
                    'points':[],
                    'value': threshold,
                }
                for(let symptom of plotSymptoms){
                    let vals = props.data[symptom].map(x => x.slice(minDateIdx,maxDateIdx));
                    let tholds = vals.map( v => Math.max(...v));
                    let nAbove = tholds.filter( v => v >= threshold);
                    let pctAbove = nAbove.length/tholds.length;
                    let [x,y] = coordinateTransform(symptom,scaleTransform(pctAbove));
                    tholdEntry.points.push([x,y]);

                    let correlation_key = 'cluster_' + symptom + '_' + threshold + '_';
                    let odds = props.data[correlation_key + 'odds_ratio'];
                    let pval = props.data[correlation_key + 'pval'];
                    curveEndpoints.push({
                        'x': x,
                        'y': y,
                        'value': pctAbove,
                        'color': significanceColor(pval,odds),
                        'radius': 3*(odds**.5),
                        'total': nAbove.length,
                        'clusterSize': tholds.length,
                        'threshold': threshold,
                        'symptom': symptom,
                        'pval': pval,
                        'odds': odds
                    })
                }
                tholdEntry.points.push(tholdEntry.points[0])
                curvePoints.push(tholdEntry)
            }
   
            const axLineFunc = d3.line()
                .x(d => d[0])
                .y(d => d[1]);

            // curveGroup.selectAll('path').filter('.symptomCurve')
            //     .data(curvePoints).enter()
            //     .append('path').attr('class','symptomCurve')
            //     .attr('d',d=> axLineFunc(d.points))
            //     .attr('stroke',d=>d.color)
            //     .attr('stroke-width',1)
            //     .attr('stroke-opacity',.5)
            //     .attr('fill',d=>d.color)
            //     .attr('fill-opacity',.5);

            curveGroup.selectAll('circle').filter('.symptomEndpoint')
                .data(curveEndpoints).enter()
                .append('circle').attr('class','symptomEndpoint')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',d=>d.radius)
                .attr('fill',d=>d.color)
                .attr('opacity',d=> (d.pval > .05)? .8: 1)
                .attr('stroke', 'black')
                .attr('stroke-width',1)
                .attr('stroke-opacity',d=> (d.pval > .05)? 0: 1)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.symptom + ' > ' + d.threshold + '</br>';
                    tipText += d.total +' out of ' + d.clusterSize + ' (' + (100*d.value).toFixed(1) + '%)' + '</br>'
                    tipText += 'odds ratio: ' + d.odds.toFixed(1) + ' (p=' + d.pval.toFixed(3) + ')' + '</br>'
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });
            setDrawn(true)
        }
            
    },[props.data,svg])


    useEffect(function brush(){
        if(svg !== undefined & drawn){
            //brush here
        }
    },[props.data,svg,drawn])


    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}