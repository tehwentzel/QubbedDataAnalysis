import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import { count } from 'd3';

export default function ClusterMetricsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [data,setData] = useState();
    const [rectsDrawn,setRectsDrawn] = useState(false);
    const yMarginTop = 10;
    const yMarginBottom = 40;
    const xMargin = 10;
    const metrics = [
        'aic_diff',
        '5_odds_ratio',
        '7_odds_ratio',
    ];
    const pvals = [
        '7_lrt_pval',
        '5_lrt_pval',
        'lrt_pval'
    ];
    const graphWidth = width/(metrics.length+1);

    function formatText(text){
        if(text == 'aic_diff'){ return '-ΔAIC (Linear).'}
        if(text.includes('odds_ratio')){
            if(text.includes('5_')){
                return 'Odds > 5';
            } else{
                return "Odds > 7";
            }
        }
        if(text.includes('lrt_pval')){
            let baseText = "1-p";
            if(text.includes('5_')){
                baseText += " (>5)";
            } else if(text.includes('7_')){
                baseText += ' (>7)';
            }
            return baseText;
        }
        return text;
    }

    useEffect(function format(){
        if(svg != undefined & props.clusterData !== undefined){
            let formattedData  = [];
            let entryId = 0;
            for(let clusterEntry of props.clusterData){
                let symptom = props.mainSymptom
                let entry = {
                    'cluster': parseInt(clusterEntry.clusterId),
                    'symptom': symptom,
                    'entryId':entryId,
                }
                entryId += 1;
                let keyBase = 'cluster_'+symptom;
                const options = metrics.concat(pvals);
                for(let metric of options){
                    let key = keyBase + '_' + metric;
                    entry[metric] = clusterEntry[key]
                    formattedData.push(entry);
                }
            }
            setData(formattedData);
        }
    },[svg,props.clusterData,props.mainSymptom,props.symptomsOfInterest])

    useEffect(function drawLines(){
        if(svg !== undefined & data !== undefined){
            //why are barcharts actually the hardest to prrogram
            svg.selectAll('rect').remove()
            var makeYScale = (accessor) => {
                let [minVal,maxVal] = d3.extent(data, d=>accessor(d));
                minVal = Math.min(0,minVal);
                let topRatio = Math.abs(maxVal)/(Math.abs(maxVal)+Math.abs(minVal));
                let h = (height-yMarginBottom-yMarginTop);
                let yCenter = h*topRatio;
                let scale = d3.scaleLinear()
                    .domain([0,maxVal])
                    .range([0,yCenter-yMarginTop]);
                var yScale =  d=> {
                    let val = accessor(d);
                    return scale(Math.abs(val));
                }
                return [yScale, yCenter]
            }

            let xBaseScale = d3.scaleLinear()
                .domain([0,metrics.length-1])
                .range([xMargin,width-graphWidth-xMargin]);

            const nClusters = 1 + d3.max(data,d=>d.cluster) - d3.min(data,d=>d.cluster);
            const barWidth = (graphWidth*.9)/(nClusters)
            let xOffsetScale = d3.scaleLinear()
                .domain(d3.extent(data,d=>d.cluster))
                .range([0,graphWidth-barWidth]);

            
            var getX = (d,key) => {
                let idx = metrics.indexOf(key);
                let xBase = xBaseScale(idx);
                let xOffset = xOffsetScale(parseInt(d.cluster));
                return xBase + xOffset;
            }

            var xAxisPoints = [];
            var xAxisData = [];
            var annoationData = [];
            const lineFunc = d3.line()
    
            var makeRect = (accessor,xKey,sigKey,sigThreshold) => {
                if(sigThreshold === undefined){
                    sigThreshold = .05;
                }
                let [yScale, yCenter] = makeYScale(accessor);
                let className = 'metricRect'+xKey;
                svg.selectAll('rect').filter('.'+className).remove();
                let getYPos = (d) => {
                    if(accessor(d) < 0){
                        return yCenter;
                    } else{
                        return yCenter-yScale(d);
                    }
                }
                var getColor = function(d){
                    let p = d[sigKey];
                    if(p < sigThreshold){
                        return props.categoricalColors(d.cluster);
                    } else{
                        return 'grey';
                    }
                }
                var getOpacity = function(d){
                     if(d[sigKey] < sigThreshold){
                         return 1;
                     } else{
                         return '.5';
                     }
                }
                let rects = svg.selectAll('rect').filter('.'+className)
                    .data(data).enter()
                    .append('rect')
                    .attr('class',className + ' metricRect')
                    .attr('y',getYPos)
                    .attr('x',d=>getX(d,xKey))
                    .attr('width',barWidth)
                    .attr('fill',getColor)
                    .attr('fill-opacity',getOpacity)
                    .attr('height',d=>yScale(d))
                    .attr('stroke','black')
                    .attr('stroke-width',0)
                    .on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = '';
                        for(let key of Object.keys(d)){
                            tipText += key + ': ' + d[key] + '</br>';
                        }
                        tTip.html(tipText);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    });

                var getTextY = d => {
                    if(accessor(d) < 0){
                        let y = getYPos(d) + yScale(d) - 5;
                        y = Math.max(yCenter+20,y)
                        return y;
                    } else{
                        let y = Math.max(getYPos(d)-5,20+yMarginTop);
                        return y;
                    }
                }
                let formatNum = (n) => {
                    n = n.toFixed(3);
                    n = n.replace(/^0+/, '')
                    n = n.replace(/^-0+/, '-')
                    n = n.replace(/0+$/, '0')
                    n = n.replace(/.$/, '')
                    return n+'';
                }
                
                svg.selectAll('text').filter('.annotation'+xKey).remove();
                let annotation = svg.selectAll('text').filter('.annotation'+xKey)
                    .data(data).enter().append('text')
                    .attr('class','annotation'+xKey)
                    .attr('x',d=>getX(d,xKey)+(.5*barWidth/formatNum(accessor(d)).length))
                    .attr('y',getTextY)
                    .style('font-size',barWidth/2.5)
                    .html(d=>formatNum(accessor(d)))

                //add axis coordinates
                let xBase = xBaseScale(metrics.indexOf(xKey))
                let points = [
                    [xBase,yCenter],
                    [xBase+graphWidth,yCenter]
                ];
                xAxisPoints.push(lineFunc(points));

                //add position of stuff
                xAxisData.push({
                    'x': xBase + 2,
                    'y': height-yMarginBottom,
                    'text':formatText(xKey),
                })

                return rects
            }
            var formatPval = (p) => 1-p;
            makeRect(d=>-d['aic_diff'],'aic_diff','lrt_pval');
            // makeRect(d=>formatPval(d['lrt_pval']),'lrt_pval',.95);
            // makeRect(d=>formatPval(d['5_lrt_pval']),'5_lrt_pval',.95);
            // makeRect(d=>formatPval(d['7_lrt_pval']),'7_lrt_pval',.95);
            makeRect(d=> (d['5_odds_ratio']-1),'5_odds_ratio','5_lrt_pval');
            makeRect(d=> (d['7_odds_ratio']-1),'7_odds_ratio', '7_lrt_pval');
            
    
            svg.selectAll('path').filter('.xAxisLines').remove();
            svg.selectAll('path').filter('.xAxisLines')
                .data(xAxisPoints).enter()
                .append('path').attr('class','xAxisLines')
                .attr('d',d=>d)
                .attr('stroke','black')
                .attr('stroke-width',3);

            svg.selectAll('text').filter('.axisTextBottom').remove();
            svg.selectAll('.axisTextBottom').data(xAxisData)
                .enter().append('text').attr('class','axisTextBottom')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y+yMarginBottom/2)
                .attr('font-size',yMarginBottom/2)
                .html(x=>x.text);

            setRectsDrawn(true);
        }
    },[svg,data]);

    useEffect(function brush(){
        if(!rectsDrawn){ return; }
        var getStrokeWidth = (d) => (d.cluster === props.activeCluster)? 3:0;
        svg.selectAll('.metricRect')
            .attr('stroke-width',getStrokeWidth)
            .on('dblclick',function(e){
                let d = d3.select(this).datum();
                if(parseInt(props.activeCluster) !== parseInt(d.cluster)){
                    props.setActiveCluster(parseInt(d.cluster));
                }
            });

        svg.selectAll('text').raise();
    },[props.activeCluster,rectsDrawn])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}
