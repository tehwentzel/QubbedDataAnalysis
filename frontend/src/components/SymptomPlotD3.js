import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import { count } from 'd3';

export default function SymptomPlotD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [clusterData,setClusterData] = useState();
    const [patientData,setPatientData] = useState();
    //this lets me group timepoints by aggregating them in a single list
    //the code takes the maximum of the groups time points for each patient
    const treatmentDates = [
        [0,1],
        [2,3],
        [4,5],
        [6,7],
        [13],
        [33],
    ];
    const tTipFeatures = ['id','hpv','t_stage','n_stage','rt','ic','concurrent','subsite','totalDose'];

    const xMargin = 20;
    const yMargin = 40;

    const maxSymptomValue = 10;
    const barWidth = (width-2*xMargin)/(treatmentDates.length + 2);
    const barHeight = (height-2*yMargin - 10)/(maxSymptomValue + 2);

    const xScale = d3.scaleLinear()
        .domain([0, treatmentDates.length-1])
        .range([xMargin + barWidth/2,width-xMargin-barWidth/2]);
    const yScale = d3.scalePow(.5)
        .domain([0,maxSymptomValue])
        .range([height-yMargin,yMargin]);
    const lineFunc = d3.line();

    function getMaxSymptom(pEntry,dateRange){
        let val = pEntry['symptoms_'+props.mainSymptom];
        if(val === undefined | pEntry.dates === undefined){
            console.log('cant get symptom values in symptom plot',pEntry,props.mainSymptom);
            return -1;
        }
        let values = dateRange.map(x => pEntry.dates.indexOf(x)).filter(x => x > -1).map(x => val[x]);
        return Math.max(...values);
    }

    function symptomListToPoints(sVals){
        let points = [];
        for(let i in sVals){
            let x = xScale(i);
            let y= yScale(sVals[i]);
            points.push([x,y])
        }
        return points
    }

    function formatPatient(pEntry,clusterId){
        let sVals = treatmentDates.map(d => getMaxSymptom(pEntry,d));
        let points = symptomListToPoints(sVals);
        let entry = {
            'clusterId': clusterId,
            'symptoms': sVals,
            'points': points,
            'path': lineFunc(points),
        }
        for(let f of tTipFeatures){
            entry[f] = pEntry[f];
        }
        return entry
    }

    function getClusterMeans(formattedPatients){
        let sLists = formattedPatients.map(x => x.symptoms);
        let nSteps = sLists[0].length;
        let means = []
        for(let i = 0; i < nSteps; i++){
            let vals = sLists.map(x => x[i])
            let meanVal = arrayMean(vals);
            means.push(meanVal);
        }
        return means;
    }

    function formatCluster(formattedPatients,clusterEntry){
        let meanVals = getClusterMeans(formattedPatients);
        let points = symptomListToPoints(meanVals);
        let size = formattedPatients.length;
        let entry = {
            'symptoms': meanVals,
            'points': points,
            'path': lineFunc(points),
            'size': size,
            'clusterId': clusterEntry.clusterId
        }
        return entry;
    }

    useEffect(function format(){
        if(svg != undefined & props.doseData != undefined & props.clusterData !== undefined){
            let pLists = [];
            let clusterMeans = [];
            console.log('syptom',props.doseData,props.clusterData);
            for(let cluster of props.clusterData){
                let patientIds = cluster.ids.map(x => parseInt(x));
                let patientData = props.doseData.filter( x => patientIds.indexOf(parseInt(x.id)) >= 0 )
                let formattedPatients = patientData.map(d => formatPatient(d,cluster.clusterId));
                for(let p of formattedPatients){
                    pLists.push(p);
                } 
                let clusterEntry = formatCluster(formattedPatients, cluster)
                clusterMeans.push(clusterEntry);
            }
            console.log('colors',props.categoricalColors(0))

            setPatientData(pLists);
            setClusterData(clusterMeans);
            
        }
    },[svg,props.clusterData,props.doseData,props.mainSymptom,props.categoricalColors])

    useEffect(function drawLines(){
        if(svg !== undefined & patientData !== undefined & clusterData !== undefined){

            console.log('acitveCluster',props.activeCluster);

            var isActive = d => (d.clusterId == props.activeCluster);

            function makeLines(data,className,oBase,wBase,showNotActive){
                svg.selectAll('path').filter('.'+className).remove();
                var getOpacity = (d,base) => isActive(d)? base:(base/1.25)*showNotActive;
                var getThickness = (d,base) => isActive(d)? base:(base*.666)*showNotActive;
                let lines = svg.selectAll('path').filter('.'+className)
                    .data(data).enter()
                    .append('path')
                    .attr('class',className)
                    .attr('d',d=>d.path)
                    .attr('fill','none')
                    .attr('stroke', d=>props.categoricalColors(d.clusterId))
                    .attr('stroke-opacity',d=>getOpacity(d,oBase))
                    .attr('stroke-width',d=>getThickness(d,wBase));
                return lines;
            }
            let activeClusterSize = patientData.filter(d=>isActive(d)).length;
            let symptomLines = makeLines(patientData,'patientLine',1/(activeClusterSize**.75),3,false);
            let clusterLines = makeLines(clusterData,'clusterLine',1,6,true);
        }
    },[svg,patientData,clusterData,props.activeCluster]);

    useEffect(function drawCircles(){
        if(svg !== undefined & patientData !== undefined & clusterData !== undefined){
            //makes a item s.t time[timepoint position map][syptomValue position map] = [#with-value in cluster 0, # with value in cluster 1 ....]
            let nActive = patientData.filter( d=> parseInt(d.clusterId) == parseInt(props.activeCluster)).length;
            let nInactive = patientData.length - nActive;
            let grid = {};
            for(let p of patientData){
                for(let [x,y] of p.points){
                    if(grid[x] === undefined){
                        grid[x] = {}
                    }
                    if(grid[x][y] === undefined){
                        grid[x][y] = [];
                        for(let i = 0; i < clusterData.length; i++){
                            grid[x][y].push(0);
                        }
                    }
                    let items = grid[x][y];
                    items[p.clusterId] = items[p.clusterId] + 1
                    grid[x][y] = items;
                }
            } 

            //define radius scale first because we need that info before formatting to make the scale
            //so it can determine which circle to put on top
            let maxInactiveTotal = 0;
            let maxActiveTotal = 0;
            for(let x of Object.keys(grid)){
                for(let y of Object.keys(grid[x])){
                    let values = grid[x][y];
                    let total = arraySum(values);
                    let activeCount = values[parseInt(props.activeCluster)];
                    maxActiveTotal = Math.max(activeCount/nActive,maxActiveTotal);
                    maxInactiveTotal = Math.max((total-activeCount)/nInactive, maxInactiveTotal);
                }
            }

            let maxR = Math.min(barWidth,barHeight)/2;
            var makeRScale = (max) => {
                return d3.scaleSymlog().domain([0,max]).range([1,maxR])
            }
            let rScaleActive = makeRScale(maxActiveTotal);
            let rScaleInactive = makeRScale(maxInactiveTotal);
            let getRadius = (count,active) => {
                if(active){
                    return rScaleActive(count/nActive);
                } else{
                    return rScaleInactive(count/nInactive);
                }
            }

            let activePoints = [];
            let otherPoints = [];
            for(let x of Object.keys(grid)){
                for(let y of Object.keys(grid[x])){
                    let values = grid[x][y];
                    let total = arraySum(values);
                    let activeCount = values[parseInt(props.activeCluster)];

                    var makePoint = (count,clusterId,front,total) => {
                        let act = (clusterId === props.activeCluster);
                        let entry = {
                            'x':x,
                            'count': count,
                            'y':y,
                            'front':front,
                            'radius': getRadius(count,act),
                            'clusterId': clusterId,
                            'active': act,
                            'total':total,
                        }
                        return entry;
                    }
                    let activeFront = getRadius(activeCount,true) <= getRadius(total-activeCount,false);
                    if(!activeFront){ console.log('true not bad whatever words')}
                    otherPoints.push(makePoint(total-activeCount,-1,!activeFront,total));
                    activePoints.push(makePoint(activeCount,props.activeCluster,activeFront,total))
                }
            }
            
            let getColor = (d) => d.active? props.categoricalColors(d.clusterId): 'none';
            let getStrokeWidth = (d) => d.active? 0:1;
            let getOpacity = (d) => d.active? 1:0;
            function plotPoints(datapoints,className){
                svg.selectAll('.'+className).remove();
                let getClass = (d) => d.front? className + ' symptomFront': className;
                let pointPlot = svg.selectAll('circle').filter('.'+className)
                    .data(datapoints).enter()
                    .append('circle').attr('class',getClass)
                    .attr('cx',d=>d.x)
                    .attr('cy',d=>d.y)
                    .attr('r',d=>d.radius)
                    .attr('fill-opacity',getOpacity)
                    .attr('stroke-width',getStrokeWidth)
                    .attr('stroke','black')
                    .attr('fill',getColor)
                return pointPlot;
            }
            plotPoints(otherPoints,'inactiveSymptomPoints');
            let active = plotPoints(activePoints,'activeSymptomPoints');
            active.on('mouseover',function(e){
                let d = d3.select(this).datum();
                console.log('data click',d);
                let dates = treatmentDates[parseInt(xScale.invert(d.x))];
                let dateString = 'Weeks: ';
                for(let date of dates){
                    dateString += date + ' ';
                }
                let value = yScale.invert(d.y);
                let unCount = (d.total - d.count)
                let tipText = dateString + '</br>'
                    + props.mainSymptom + ': ' + value + "</br>"
                    + 'in-cluster: ' + d.count + ' (' + (100*d.count/nActive).toFixed(1) + '%)' + '</br>'
                    + 'outof-cluster: ' +unCount + ' (' + (100*unCount/nInactive).toFixed(1) + '%)' + '</br>'
                    + 'odds ratio: ' + ((d.count/nActive)/(unCount/nInactive)).toFixed(2) + '</br>'
                    + 'cluster: ' + d.clusterId + "</br>"
                tTip.html(tipText);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            });
            svg.selectAll('.symptomFront').raise();
        }
    },[svg,patientData,clusterData,props.activeCluster]);

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}

function arrayMean(array){
    let sum = 0;
    for(let val of array){
        if(val !== undefined){
            sum += val;
        }
    }
    return sum/array.length;
}

function arraySum(array){
    let sum = 0;
    for(let val of array){
        if(val !== undefined){
            sum += val;
        }
    }
    return sum;
}