import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function ClusterSymptomsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [drawn, setDrawn] = useState(false);

    // const plotSymptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis']
    const minWeeks = 13;
    const maxWeeks = 33;


    const thresholds = [5,7,9]

    const angleIncrement = 2*Math.PI/props.plotSymptoms.length;
    
    const margin = 10;
    const radius = Math.min(height/2 - margin,width/2 - margin);
    const valueRange = [0,10];
    const scaleTransform = x => x;
    // const getSeverityColor = x => d3.interpolateOranges(scaleTransform(x)/valueRange[1]);
    const getSeverityColor = x => {
        if(x < 5){
            return '#af8dc3'
        } else if(x < 7){
            return '#f16913'
        } else if(x < 9){
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
        let angle = props.plotSymptoms.indexOf(sname)*angleIncrement;
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
            for(let symptom of props.plotSymptoms){
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
                .attr('r',1)
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
    },[svg,height,width,props.plotSymptoms])

    useEffect(function draw(){
        
        if(svg !== undefined & props.data != undefined & height > 0 & width > 0){
            svg.selectAll('g').filter('.symptomCurveGroup').remove();
            var curveGroup = svg.append('g').attr('class','symptomCurveGroup')
            setDrawn(false);
            let curvePoints = [];
            let curveEndpoints = [];
            let minDateIdx = props.data.dates.indexOf(minWeeks);
            let maxDateIdx = props.data.dates.length;
            let getRadius = v => 2+(5*(v/valueRange[1]))**(.5)
            if(maxWeeks > 0){
                let maxDateIdx = props.data.dates.indexOf(maxWeeks)
            }
            for(let threshold of thresholds){
                let tholdEntry = {
                    'color': 'blue',
                    'points':[],
                    'value': threshold,
                }
                for(let symptom of props.plotSymptoms){
                    let vals = props.data['symptoms_'+symptom].slice(minDateIdx,maxDateIdx+1);
                    let maxVal = Math.max(...vals)
                    let [x,y] = coordinateTransform(symptom,scaleTransform(maxVal));
                    tholdEntry.points.push([x,y]);
                    if(maxVal > 0){
                        curveEndpoints.push({
                            'x': x,
                            'y': y,
                            'value': maxVal,
                            'color': getSeverityColor(maxVal),
                            'radius': getRadius(maxVal),
                            'threshold': threshold,
                            'symptom': symptom,
                        })
                    }
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
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.symptom + ' ' + d.value;
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });
            setDrawn(true)
        }
            
    },[props.data,svg,props.plotSymptoms])


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