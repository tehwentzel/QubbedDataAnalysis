import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import {forceSimulation,forceCollide,forceCenter, forceManyBody, thresholdFreedmanDiaconis, symbolWye, precisionPrefix} from 'd3';

export default function PatientScatterPlotD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [formattedData,setFormattedData] = useState();
    const [dotsDrawn,setDotsDrawn] = useState(false);
    const symptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis'];
    const margin = 50;
    const curveMargin = 3;
    

    function getR(d){
        //if I want to make this fancy
        //in the proproccessing I make thes all unitl scale
        let val = d[props.sizeVar] + .1;
        if(val === undefined){
            val = .4;
        }
        return 10*(val**.5);
    }

    function getShape(d){
        let val = d[props.sizeVar];
        //visual error message lol
        if(val === undefined){
            return d3.symbolWye;
        }
        let severe = val >= .5;
        let mostSevere = val >= .7;
        if(props.sizeVar === 'tstage' || props.sizeVar === 'nstage'){
            severe = val > .5;
            mostSevere = val >= .99;
        }
        let symbol = d3.symbol();
        let size =10*getR(d);
        let sType = d3.symbolCircle;
        if(mostSevere){
            sType = d3.symbolDiamond;
            // size *= 1.5;//circles are smaller for some reason
        } else if(severe){
            sType = d3.symbolTriangle;
            // size *= 1.5;
        }
        return symbol.size(size).type(sType)();
    }

    useEffect(function formatData(){
        if(props.doseData != undefined & props.clusterData !== undefined){
            
            function formatData(d){
                let newD = Object.assign(d,{})
            
                for(let prefix of ['dose','symptom_all','symptom_post','symptom_treatment']){
                    let pcaVal = d[prefix+'_pca']
                    for(let num of [1,2,3]){
                        newD[prefix+'_pca'+num] = pcaVal[num-1];
                    }
                }
            
                let valMap = {
                    't1': 1/4,
                    't2': 2/4,
                    't3': 3/4,
                    't4': 4/4,
                    'n2a': 1/4,
                    'n2b': 2/4,
                    'n2c': 3/4,
                    'n3': 4/4,
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
                            'color': props.categoricalColors(d.clusterId),
                            'id': id,
                        }
                        newPoint = Object.assign(dpoint,newPoint)
                        dataPoints.push(newPoint);
                    }
                }
            });
            setFormattedData(dataPoints);

            // console.log('scatter data',dataPoints)
        }
    },[props.clusterData,props.doseData])

    useEffect(function drawPoints(){
        if(svg !== undefined & formattedData !== undefined & height > 0 & width > 0 & props.xVar !== undefined & props.yVar !== undefined){
            setDotsDrawn(false);
            svg.selectAll('.clusterOutline').attr('visibility','hidden')
            function getScale(varName, range){
                let extents = d3.extent(formattedData.map((d) => d[varName]));
                let scale = d3.scaleLinear()
                    .domain(extents)
                    .range(range)
                return d => scale(d[varName])
            }
            let getX = getScale(props.xVar,[margin,width-margin])
            let getY = getScale(props.yVar, [height-margin,margin])
            // let getR = getScale(props.sizeVar, [1,5])//when i make it point scaled instead of shapes
            let newData = [];
            for(let e of formattedData){
                e.x = getX(e);
                e.y = getY(e);
                newData.push(e);
            }

            let scatterGroup = svg.selectAll('.scatterPoint').data(formattedData);
            scatterGroup.exit().remove();
            function drawHull(dataList){
                var hullData = [];
                var curveFunc = d3.line(d=>d[0],d=>d[1])
                    .curve(d3.curveCatmullRom.alpha(0.1))
                props.clusterData.forEach((clusterEntry,i)=>{
                    let cid = clusterEntry.clusterId;
                    let dpoints = dataList.filter(x=>x.cluster == cid);
                    if(dpoints.length >= 3){
                        var [minX,maxX,minY,maxY] = [100000,0,100000,0]
                        let points = dpoints.map((d)=>{
                            let tempx = d.x;
                            let tempy = d.y;
                            minX = Math.min(minX,tempx);
                            minY = Math.min(minY,tempy);
                            maxX = Math.max(maxX,tempx);
                            maxY = Math.max(maxY,tempy);
                            return [d.x,d.y]
                        });
                        let hull = d3.polygonHull(points);
                        hull.push(hull[0]);

                        let centerX = minX + (maxX - minX)/2;
                        let centerY = minY + (maxY - minY)/2;
                        hull = hull.map(([x,y])=>{
                            let offsetX = x-centerX;
                            let offsetY = y-centerY;
                            let modifier = curveMargin/((offsetX**2) + (offsetY**2))**.5
                            let newX = x + offsetX*modifier;
                            let newY = y + offsetY*modifier;
                            return [newX,newY];
                        });
                        let entry = {
                            'path': curveFunc(hull),
                            'color': props.categoricalColors(cid),
                            'cluster': cid,
                            'active': (cid === props.activeCluster),
                            'nItems': dpoints.length,
                        }
                        hullData.push(entry)
                    }
                })

                var clusterOutlines = svg.selectAll('.clusterOutline').data(hullData)
                clusterOutlines.exit().remove();
                clusterOutlines.enter()
                    .append('path')
                    // .merge(clusterOutlines)
                    .attr('class','clusterOutline')

                clusterOutlines//.transition(t)
                    .attr('d',d=>d.path)
                    .attr('stroke',d=>d.color)
                    .attr('stroke-width',2)
                    .attr('fill','none')
                    .attr('stroke-opacity',1)

                clusterOutlines
                    .on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = 'cluster ' + d.cluster + ' n=' + d.nItems;
                        tTip.html(tipText);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    }).on('dblclick',function(e){
                        let d = d3.select(this).datum();
                        if(props.activeCluster !== d.cluster){
                            props.setActiveCluster(d.cluster)
                        }
                    });
                
            }

            function uncollide(){
                var ticked = function(){
                    svg.selectAll('.scatterPoint')
                        .attr('transform',d=> {return 'translate(' + (d.x) + ',' + (d.y) + ')';});
                }
    
                var simulation = forceSimulation(newData)
                    .force('collide',forceCollide().radius(getR))
                    .alphaMin(.2)
                    .on('tick',ticked)
                    .on('end',function(){
                        
                        drawHull(newData);

                        scatterGroup.on('mouseover',function(e){
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
                        console.log('done');

                    })
            }

            var formatDots = g => {
                g.attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                    .attr('d',getShape)
                    .attr('fill', d => d.color)
                    .attr('r',getR);
            }
            if(scatterGroup.empty()){
                scatterGroup
                    .enter().append('path')
                    .attr('class','scatterPoint')
                    .attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                    .attr('d',getShape)
                    .attr('fill', d => d.color)
                    .attr('r',getR);

                uncollide();
            } else{
                var t = d3.transition()
                .duration(400)
                .on('end',uncollide);
    
                scatterGroup
                    .enter().append('path')
                    .merge(scatterGroup)
                    .attr('class','scatterPoint');

                // scatterGroup.exit().remove();

                scatterGroup
                    .transition(t)
                    .attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                    .attr('d',getShape)
                    .attr('fill', d => d.color)
                    .attr('r',getR);
            }
        
        }
    },[svg,height,width,props.clusterData,formattedData,props.xVar,props.yVar])

    useEffect(function makeShape(){
        if(formattedData !== undefined & dotsDrawn & props.sizeVar !== undefined){
            svg.selectAll('.scatterPoint')
                .attr('d',getShape);
        }
    },[props.clusterData,formattedData,dotsDrawn,props.sizeVar]);

    useEffect(function brush(){
        if(formattedData !==undefined & dotsDrawn){
            let scatterGroup = svg.selectAll('.scatterPoint').data(formattedData);
            scatterGroup.exit().remove();
            // console.log('scattergroup',scatterGroup)
            let isActive = (d) => d.cluster == props.activeCluster;
            let isSelected = (d) => (parseInt(d.id) == props.selectedPatientId);
            scatterGroup
                .enter()
                .append('circle').attr('class','scatterPoint')
                .merge(scatterGroup)
                .attr('opacity', (d)=> isActive(d)? 1:.4)
                .attr('stroke','black')
                .attr('stroke-width', (d) => {
                    let w = 0.1;
                    if(isActive(d)){
                        w = .3;
                    }
                    if(isSelected(d)){
                        w *= 10;
                    }
                    return w;
                })
                .on('dblclick',function(e){
                    let d = d3.select(this).datum();
                    if(parseInt(d.cluster) !== parseInt(props.activeCluster)){
                        props.setActiveCluster(parseInt(d.cluster));
                    } 
                    if(d.id !== props.selectedPatientId){
                        props.setSelectedPatientId(parseInt(d.id));
                    }
                });
            
                //brush active cluster
                svg.selectAll('.clusterOutline')
                    .attr('visibility',d=>isActive(d)?'visible':'hidden');
        }
    },[props.clusterData,formattedData,dotsDrawn, props.selectedPatientId,props.activeCluster])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}