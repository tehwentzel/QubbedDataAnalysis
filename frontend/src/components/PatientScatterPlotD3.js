import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import { interpolate } from 'd3';

export default function PatientScatterPlotD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [formattedData,setFormattedData] = useState();
    const [dotsDrawn,setDotsDrawn] = useState(false);
    const symptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis'];
    const margin = 10;
    const categoricalColors = d3.scaleOrdinal()
        .domain([0,7])
        .range(['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00']);

    useEffect(function formatData(){
        if(props.doseData != undefined & props.clusterData !== undefined){
            
            function formatData(d){
                let newD = Object.assign(d,{})
            
                newD.pca1 = d.dose_pca[0];
                newD.pca2 = d.dose_pca[1];
                newD.pca3 = d.dose_pca[2];
            
                let valMap = {
                    't1': 1/4,
                    't2': 2/4,
                    't3': 3/4,
                    't4': 4/4,
                    'n2a': 1/2,
                    'n2b': 1/2,
                    'n2c': 2/2,
                    'n3': 2/2,
                }
                function fromMap(v){
                    let val = valMap[v];
                    if(val === undefined){ val = 0; }
                    return val
                }
                newD.tstage = fromMap(d.t_stage);
                newD.nstage = fromMap(d.n_stage);
        
                let dateSliceStart = d.dates.indexOf(13);
                let dateSliceStop = d.dates.indexOf(33)
                for(let sympt of symptoms){
                    let svals = d['symptoms_'+sympt].slice(dateSliceStart,dateSliceStop+1)
                    newD[sympt] = Math.max(...svals)/10;
                }
                return newD;
            }

            var dataPoints = [];
            props.clusterData.forEach((clusterEntry,i)=>{
                let d = Object.assign(clusterEntry,{})
                for(let id of d.ids){
                    let dpoint = props.doseData.filter(d=>d.id == id)[0];
                    if(dpoint !== undefined){
                        dpoint = formatData(dpoint);

                        let newPoint = {
                            'cluster': d.clusterId,
                            'color': categoricalColors(d.clusterId),
                            'id': id,
                        }
                        for(let varName of [props.xVar,props.yVar,props.sizeVar]){
                            newPoint[varName] = dpoint[varName];
                        }
                        for(let symptom of symptoms){
                            newPoint[symptom] = dpoint[symptom];
                        }

                        dataPoints.push(newPoint);
                    }
                }
            });
            setFormattedData(dataPoints);

            // console.log('scatter data',dataPoints)
        }
    },[props.clusterData,props.doseData])


    useEffect(function drawPoints(){
        if(svg !== undefined & formattedData !== undefined){

            function getScale(varName, range){
                let extents = d3.extent(formattedData.map((d) => d[varName]));
                let scale = d3.scaleLinear()
                    .domain(extents)
                    .range(range)
                return d => scale(d[varName])
            }
            let getX = getScale(props.xVar,[margin,width-margin])
            let getY = getScale(props.yVar, [height-margin,margin])
            let getR = getScale(props.sizeVar, [2,4])

            svg.selectAll('.scatterGroup').remove();
            setDotsDrawn(false);
            let scatterGroup = svg.append('g').attr('class','scatterGroup')
            scatterGroup.selectAll('circle').filter('.scatterPoint')
                .data(formattedData).enter()
                .append('circle').attr('class','scatterPoint')
                .attr('cx', getX)
                .attr('cy',getY)
                .attr('r',getR)
                .attr('fill', d => d.color)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = 'patient ' + d.id + '</br>'
                        + 'cluster: ' + d.cluster + '</br>'
                        + props.xVar + ': ' + d[props.xVar].toFixed(1) + '</br>'
                        + props.yVar + ': ' + d[props.yVar].toFixed(1) + '</br>'
                        + props.sizeVar + ': ' + d[props.sizeVar].toFixed(1) + '</br>'
                    for(let symp of symptoms){
                        tipText += 'late '+ symp + ': ' + (d[symp]*10).toFixed(0) + '</br>'
                    }
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });
            setDotsDrawn(true);

        }
    },[svg,formattedData,props.xVar,props.yVar,props.sizeVar])

    useEffect(function brush(){
        if(formattedData !==undefined & dotsDrawn){
            let scatterGroup = svg.selectAll('.scatterPoint').data(formattedData);
            scatterGroup.exit().remove();
            console.log('scattergroup',scatterGroup)
            scatterGroup
                .enter()
                .append('circle').attr('class','scatterPoint')
                .merge(scatterGroup)
                .attr('opacity', d => (d.cluster == props.activeCluster)? 1:.4)
                .attr('stroke','black')
                .attr('stroke-width', d=> (parseInt(d.id) == props.selectedPatientId)? 2:0)
                .on('dblclick',function(e){
                    let d = d3.select(this).datum();
                    if(d.cluster == props.activeCluster){
                        props.setSelectedPatientId(parseInt(d.id));
                    }
                });
                
        }
    },[formattedData,dotsDrawn, props.selectedPatientId,props.activeCluster])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}