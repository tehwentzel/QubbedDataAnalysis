import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import {forceSimulation,forceCollide} from 'd3';
import { transition } from 'd3-transition';

export default function PatientScatterPlotD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [formattedData,setFormattedData] = useState();
    const [dotsDrawn,setDotsDrawn] = useState(false);
    const maxR = .015*Math.min(width,height);
    const margin = Math.min(80,4*maxR);
    const curveMargin = 3;
    
    const tipChartSize = [150,80];
    const tipSymptomChartSize = [160,15];//height is for each symptom here
    const legendHeight = 80;
    const legendWidth = 60;
    const legendMargin = 30;

    function rScale(val){
        return maxR*(val**.25);
    }

    function getR(d){
        //if I want to make this fancy
        //in the proproccessing I make thes all unitl scale
        let val = d[props.sizeVar] + .1;
        if(val === undefined){
            val = .4;
        }
        return rScale(val);
    }

    function radToCartesian(angle,scale=1){
        let x = Math.cos(angle)*scale;
        let y = Math.sin(angle)*scale;
        return [x,y];
    }

    function circlePath(r){
        let path = 'm 0,0 '
            + 'M ' + (-r) + ', 0 '
            + 'a ' + r + ',' + r + ' 0 1,0 ' + (2*r) + ',0 '
            + 'a ' + r + ',' + r + ' 0 1,0 ' + (-2*r) + ',0 z';
        return path;
    }

    function valToShape(val,size){
        if(size === undefined){
            size = rScale(val);
        }
        if(val === undefined){
            return d3.symbol().size(size).type(d3.symbolSquare);
        }
        let string = circlePath(size) + ' M 0,0 ';
        let currAngle = -Math.PI/2;
        var arcLength = 2*Math.PI/11;
        var addArc = (pString,angle) => {
            let [x,y] = radToCartesian(angle);
            let newString = " L" + size*x + ',' + size*y + ' 0,0';
            return pString + newString;
        }
        for(let i = 0; i < val; i += .1){
            string = addArc(string,currAngle);
            currAngle += arcLength;
        }
        return string;
    }

    function getShape(d){
        let val = d[props.sizeVar];
        let size = getR(d);
        return valToShape(val,size);
    }

    function getMaxSymptoms(pEntry,symptom,dates){
        if(dates == undefined){
            dates = props.endpointDates;
        }
        let val = pEntry['symptoms_'+symptom];
        if(val === undefined | pEntry.dates === undefined){
            return -1;
        }
        let dateIdxs = dates.map(x => pEntry.dates.indexOf(x)).filter(x => x > -1);
        let values = dateIdxs.map(i => val[i]).filter(x => x!==undefined);
        if(values.length > 1){
            return Math.max(...values);
        } else{
            return values[0];
        }
    }

    function makeTTipChart(element, data){
        let [w,h] = tipChartSize;
        
        let doseSvg = Utils.addTTipCanvas(element,'tTipDoseCanvas',w,h)
        
        let paths = props.svgPaths['both'];
        if(paths === undefined){
            console.log('error getting svg paths for tooltip',props.svgPaths);
            return;
        }

        let svgOrganList = Object.keys(paths);
        let maxDVal = 70;
        let minDVal = 0;
        let plotVar = props.plotVar;
        let values = data[plotVar];

        let pathData = [];
        for(let organ of svgOrganList){
            let pos = data.organList.indexOf(organ);
            if(pos < 0){ continue; }
            let dVal = values[pos];
            let path = paths[organ];
            let entry = {
                'dVal': dVal,
                'organ_name': organ,
                'plotVar': plotVar,
                'path': path,
            }
            pathData.push(entry)
            if(dVal > maxDVal){ maxDVal = dVal; }
            if(dVal < minDVal){ minDVal = dVal; }
        }

        doseSvg.selectAll('g').filter('.organGroup').remove();
        const organGroup = doseSvg.append('g')
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

        let getColor = d3.interpolateReds;
        organGroup
            .selectAll('path').filter('.organPath')
            .data(pathData)
            .enter().append('path')
            .attr('class','organPath')
            .attr('d',x=>x.path)
            // .attr('transform',(d,i)=>transforms[i])
            .attr('fill', x=>getColor(colorScale(x.dVal)))
            .attr('stroke','black')
            .attr('stroke-width','.1');

        let box = doseSvg.node().getBBox();
        let transform = 'translate(' + (-box.x)*(w/box.width)  + ',' + (-box.y)*(h/box.height) + ')';
        transform += ' scale(' + w/box.width + ',' + (-h/box.height) + ')';
        doseSvg.selectAll('g').attr('transform',transform);
    }
    
    function makeTTipLrtChart(element, data){
        if(props.symptomsOfInterest === undefined){ return; }
        let [w,h] = tipSymptomChartSize
        h = h*props.symptomsOfInterest.length
        const margin = 5;
        
        const maxHeight = (.5*h/props.symptomsOfInterest.length) - 2;
        const fontSize = Math.min(2*maxHeight, 10);
        const textWidth = fontSize*7;

        const maxWidth = (w-textWidth-2*margin)/20;
        const radius = Math.min(maxHeight,maxWidth);
        
        let tipSvg = Utils.addTTipCanvas(element, 'scatterTipSvg',w+2*margin,h+2*margin);
        tipSvg.attr('background','white')
        let xScale = d3.scaleLinear()
            .domain([0,10])
            .range([margin+textWidth,w-margin])
        let yScale = d3.scaleLinear()
            .domain([0,props.symptomsOfInterest.length-1])
            .range([h-margin-radius*2,margin]);
        let sVals = props.symptomsOfInterest.map((s,i) => {
            let entry = {
                'treatment': getMaxSymptoms(data,s, [0,2,3,4,5,6,7]),
                '6W': getMaxSymptoms(data,s,[13]),
                '6M': getMaxSymptoms(data,s,[33]),
                'name': s,
                'y': yScale(i),
            }
            return entry
        });
        
        
        var plotDots = function(xKey,color){
            let cString = '.TipCircle'+xKey;
            // tipSvg.selectAll(cString).remove();
            let dots = tipSvg.selectAll(cString)
                .data(sVals)
                .enter().append('circle')
                .attr('class', 'TipCircle'+xKey)
                .attr('cy',d=>d.y)
                .attr('fill',color)
                .attr('r',radius)
                .attr('cx',d=> xScale(d[xKey]));
            return dots;
        }
        // plotDots('treatment','green');
        plotDots('6W','grey');
        plotDots('6M','black');


        tipSvg.selectAll('text').filter('.symptomText')
            .data(sVals).enter()
            .append('text').attr('class','symptomText')
            .attr('x',1).attr('y',d=>d.y+(fontSize/2))
            .attr('text-width',textWidth)
            .attr('font-size',fontSize)
            .html(d=>d.name+'|')

        const lineFunc = d3.line();
        let axisLines = [3,5].map(v=>{
            let path = lineFunc([
                [xScale(v),yScale(0)],
                [xScale(v),yScale(props.symptomsOfInterest.length)]
            ])
            let name = '>= ' + v;
            let entry = {
                'path': path,
                'value':v,
                'x': xScale(v),
                'name': name,
            }
            return entry
        })
        tipSvg.selectAll('path').filter('.axisLines').remove();
        tipSvg.selectAll('path').filter('.axisLines')
            .data(axisLines).enter()
            .append('path')
            .attr('class','axisLines')
            .attr('d',d=>d.path)
            .attr('stroke-width',1)
            .attr('stroke','black')
            .attr('stroke-opacity',.5)
            .attr('fill','none');
        tipSvg.selectAll('text').filter('.xAxisText')
            .data(axisLines).enter()
            .append('text').attr('class','xAxisText')
            .attr('x',d=>d.x)
            .attr('y',h-radius)
            .attr('text-anchor','middle')
            .attr('font-size',fontSize)
            .attr('textWidth',textWidth)
            .html(d=>d.name)
    }

    useEffect(function formatData(){
        if(props.doseData != undefined & props.clusterData !== undefined){
            
            function formatData(d){
                let newD = Object.assign(d,{})
            
                for(let prefix of ['cluster_organ','dose','symptom_all','symptom_post','symptom_treatment']){
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
        
                // let dateSliceStart = d.dates.indexOf(13);
                // let dateSliceStop = d.dates.indexOf(33);
                for(let sympt of props.symptomsOfInterest){
                    // let svals = d['symptoms_'+sympt].slice(dateSliceStart,dateSliceStop+1)
                    // newD[sympt] = Math.max(...svals)/10;
                    newD[sympt] = getMaxSymptoms(d, sympt, props.endpointDates)/10
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

        }
    },[props.clusterData,props.doseData,props.endpointDates])

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
                    .attr('visibility',d=>d.active? 'visible':'hidden');

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
            function boundX(d){return Math.max(maxR, Math.min(width-maxR, d.x))}
            function boundY(d){return Math.max(maxR, Math.min(height-maxR, d.y))}
            function uncollide(){
                var ticked = function(){
                    //bound to edges of svg
                    svg.selectAll('.scatterPoint')
                        .attr('transform',d=> {return 'translate(' + boundX(d) + ',' + boundY(d) + ')';});
                }
    
                forceSimulation(newData)
                    .force('collide',forceCollide().radius(getR))
                    .alphaMin(.3)
                    .on('tick',ticked)
                    .on('end',function(){
                        //for some reason this doesn't work on the first go still
                        // drawHull(newData);
                        setDotsDrawn(true);

                    })
            }

            if(scatterGroup.empty()){
                scatterGroup
                    .enter().append('path')
                    .attr('class','scatterPoint')
                    .attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                    .attr('d',getShape)
                    .attr('fill', d => d.color);

                // onHover(scatterGroup);
                // uncollide();
            }
            function getTransition(){
                return transition()
                    .duration(400)
                    .on('end',uncollide);
            } 

            scatterGroup
                .enter().append('path')
                .merge(scatterGroup)
                .attr('class','scatterPoint');

            scatterGroup.exit().remove();

            scatterGroup
                .transition(getTransition())
                .attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                .attr('d',getShape)
                .attr('fill', d => d.color);
            
        }
    },[svg,height,width,props.clusterData,formattedData,props.xVar,props.yVar,props.sizeVar])

    useEffect(function makeShape(){
        if(formattedData !== undefined & dotsDrawn & props.sizeVar !== undefined){
            //fill in pinwheel shape after simulation is done for layout
            svg.selectAll('.scatterPoint')
                .attr('d',getShape);
            //stuff for drawing the legend
            //figure out the corner that it's best to draw in

            //get clostest point to each corner
            let ltDist = 10000;
            let rtDist = 10000;
            let lbDist = 10000;
            let rbDist = 10000;
            let distSquared = (d,x0,y0) => {
                //distance squared is faster than just distanc
                let vect = (d.x - x0)**2 + (d.y -y0)**2;
                return vect
            }
            let minDist = (d,x0,y0,currMin) =>{
                let dist = distSquared(d,x0,y0)
                if(dist < currMin){
                    return dist;
                } 
                return currMin;
            }
            svg.selectAll('.scatterPoint').each((d,i)=>{
                ltDist = minDist(d,0,0,ltDist);
                rtDist = minDist(d,width,0,rtDist);
                lbDist = minDist(d,0,height,lbDist);
                rbDist = minDist(d,width,height,rbDist);
            });
            //calibrate start position baseed on the corner
            var legendTop = height - legendHeight;
            var legendLeft = legendMargin;
            const minCorner = Math.max(ltDist,rtDist,lbDist,rbDist);
            if(rtDist === minCorner | rbDist === minCorner){
                legendLeft = width - legendWidth;
            }
            if(ltDist === minCorner | rtDist === minCorner){
                legendTop = legendMargin;
            }
            //values = 0 is special case for the legend title
            //other values are the ones included in the legend
            const legendVals = [0,.1,.5,.9];
            let currY = legendTop;
            var legendData = legendVals.map((v) => {
                let shape = valToShape(v);
                let entry = {
                    y: currY,
                    shape: shape,
                    x: legendLeft + maxR,
                    isTitle: (v === 0),
                    textX: (v===0)? legendLeft-(maxR*props.sizeVar.length/2):legendLeft + 2*maxR+1,
                    text: (v===0)? props.sizeVar : (10*v).toFixed(0),
                    fontSize: (v===0)? 2.2*maxR:2*maxR,
                    fontWeight: (v===0)? 'bold':'',
                }
                currY += 2*maxR;
                return entry;
            })
            
            svg.selectAll('.legendShapes').remove();
            svg.selectAll('.legendShapes')
                .data(legendData).enter()
                .append('path')
                .attr('class','legendShapes')
                .attr('transform',d=> 'translate(' + d.x + ',' + d.y + ')')
                .attr('d',d=>d.shape)
                .attr('fill','gray')
                .attr('stroke','black')
                .attr('stroke-width',1)
                .attr('visibility',d=>d.isTitle? 'hidden':'visible');

            svg.selectAll('.legendText').remove();
            svg.selectAll('.legendText').data(legendData)
                .enter().append('text')
                .attr('class','legendText')
                .attr('x',d=>d.textX)
                .attr('y',d=>d.y+1)
                .attr('text-anchor','start')
                .attr('alignment-baseline','middle')
                .attr('font-size',d=>d.fontSize)
                .attr('font-weight',d=>d.fontWeight)
                .text(d=> d.text)
        }
    },[svg,props.clusterData,formattedData,dotsDrawn,props.sizeVar,props.xVar,props.yVar]);

    useEffect(function brush(){
        if(formattedData !==undefined & dotsDrawn){
            let scatterGroup = svg.selectAll('.scatterPoint').data(formattedData);
            scatterGroup.exit().remove();
            
            let isActive = (d) => d.cluster == props.activeCluster;
            let isSelected = (d) => (parseInt(d.id) == props.selectedPatientId);
            scatterGroup
                .enter()
                .append('circle').attr('class','scatterPoint')
                .merge(scatterGroup)
                .attr('opacity', (d)=> isActive(d)? 1:.75)
                .attr('stroke','black')
                .attr('stroke-width', (d) => {
                    let w = 1;
                    if(isSelected(d)){
                        w *= 1.5;
                    }
                    return w;
                }).on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = 'patient ' + d.id + '</br>'
                            + 'cluster: ' + d.cluster + '</br>'
                            + props.xVar + ': ' + d[props.xVar].toFixed(1) + '</br>'
                            + props.yVar + ': ' + d[props.yVar].toFixed(1) + '</br>'
                            + props.sizeVar + ': ' + d[props.sizeVar].toFixed(1) + '</br>'

                        tTip.html(tipText);
                        makeTTipChart(tTip,d);
                        makeTTipLrtChart(tTip,d);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                        tTip.selectAll('svg').remove()
                    }).on('dblclick',function(e){
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