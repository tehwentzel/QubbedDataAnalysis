import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';

export default function ClusterViewD3({data, colorScales, height, extents, selectedFrame, appProps}){
    const d3Container = useRef(null);

    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const [svgCreated,setSvgCreated] = useState(false);
    const [svgDrawn, setSvgDrawn] = useState(false)

    const yMargin = 0;
    const xMargin = 10;
    const barSpacing = 8;
    const continuousVarRatio = .6;

    useEffect(function makeSvg(){
        if(data && d3Container.current){
            d3.select(d3Container.current).selectAll('svg').remove();
            setSvgCreated(false);
            //this ones different because we need to calculate the height in the parent and pass it as a property
            var w = d3Container.current.clientWidth;

            var canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('class','frameEntryD3')
                .attr('width',w)
                .attr('height',height)
                .attr('lol','lol')
                .attr('background','grey');

            if(d3.select('body').select('.tooltip').empty()){
                d3.select('body').append('div')
                    .attr('class','tooltip')
                    .style('visibility','hidden');
            }
            var tip = d3.select('body').select('.tooltip');

            setWidth(w);
            setSvg(canvas);
            setTTip(tip);
            setSvgCreated(true);
        }
    },[d3Container.current, height]);

    useEffect(function drawTimeline(){
        if (data && svgCreated) {
            //frames, cases_per_capita_discrete (list), for_sah, is_blue (list?), is_vivid, retweet_count (list), group_num, total_tweets
            if(data === undefined || colorScales === undefined){ return; }
            setSvgDrawn(false);
            var barVars = ['cases_per_capita_discrete','retweet_count'];
            //add the demogrpahics in reverse order so it reads in the same order the backend splits the data.
            let sd = appProps.selectedDemographics;
            for(const i in sd){
                let dem = sd[sd.length - 1 - i];
                if(!barVars.includes(dem)){
                    barVars.unshift(dem);
                }
            }

            var ratioVars = ['for_sah', 'is_vivid', 'is_blue','sentiment'];
            ratioVars.push(appProps.selectedFrame)

            var barWidth = (width*continuousVarRatio - xMargin)/barVars.length;
            var ratioWidth = (width*(1-continuousVarRatio) - xMargin)/(ratioVars.length);

            var currX = xMargin;
            var bVarData = [];
            var barHeight = height - yMargin;
            for(const bVar of barVars){
                var getColor = colorScales[bVar];
                let values = data[bVar];
                var totalValues = values.length;
                let itemWidth = (barWidth - barSpacing)/values.length;
                var currValue = 0;
                var nItems = 1;
                var runningTotal = 0;
                var currExtents = extents[bVar];
                var quantileWidth= Math.max(Math.log(currExtents.max/(currExtents.max - currExtents.min)), (currExtents.max - currExtents.min)*.01);
                for(var v of values){
                    runningTotal += 1;
                    var entry = {
                        maxValue: v,
                        height: barHeight,
                        x: currX,
                        y: yMargin/2,
                        varName: bVar,
                        nItems: nItems,
                        totalItems: totalValues
                    }
                    if(Math.abs(v - currValue) <= quantileWidth & runningTotal < values.length){
                        nItems += 1;
                    } 
                    else{
                        entry.width = itemWidth*nItems;
                        entry.minValue = (nItems > 1)? currValue:v;
                        entry.fill = getColor((v + currValue)/2)
                        currX += entry.width;
                        bVarData.push(entry);
                        currValue = v;
                        nItems = 1;
                    }
                }
                currX += barSpacing;
            }

            d3.select(d3Container.current).select('svg').selectAll('g').filter('.barVarGroup').remove();
            var barVarRectGroup = d3.select(d3Container.current).select('svg').append('g')
                .attr('class','barVarGroup');

            var barVarRects = barVarRectGroup.selectAll('rect').filter('.barVarRect')
                .data(bVarData).enter()
                .append('rect')
                .attr('class','barVarRect')
                .attr('x', d=>d.x)
                .attr('y', d=>d.y)
                .attr('width', d=>d.width)
                .attr('height', d=>d.height)
                .attr('fill', d=>d.fill)
                .attr('stroke-width', 0)
                .on('mouseover', function(e){
                    let d = d3.select(this).datum()
                    let tipText = Utils.getVarDisplayName(d.varName) + '</br>'
                        + 'value: ' + d.minValue.toFixed(1) + '-' + d.maxValue.toFixed(1) + '</br>' 
                        + d.nItems + '/' + d.totalItems + ' (' + 100*(d.nItems/d.totalItems).toFixed(2) + '%)';
                    tTip.html(tipText)
                }).on('mousemove', function(e){
                    Utils.moveTTip(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            barVarRects.exit().remove();

            var ratioBarData = [];
            var ratioBarWidth = ratioWidth - barSpacing;
            var ratioModifier = x => Math.log(x+1)
            for(const ratioVar of ratioVars){
                var forCount;
                var againstCount;
                var getWidth;
                if(ratioVar !== 'sentiment'){
                    forCount = data[ratioVar];
                    againstCount = data.total_tweets - forCount;
                    getWidth = twtCount => (ratioModifier(twtCount)/(ratioModifier(forCount) + ratioModifier(againstCount)))*ratioBarWidth;
                } else {
                    forCount = data['positive_sentiment'];
                    againstCount = data['negative_sentiment'];
                    getWidth = twtCount => (twtCount/data.total_tweets)*ratioBarWidth;
                }
                let getClass = v => appProps.colorManager.getCategoricalClass(ratioVar, v);
                var addEntry = function(count, value){
                    let currWidth = getWidth(count);
                    var entry = {
                        varName: ratioVar,
                        count: count,
                        total: data.total_tweets,
                        width: currWidth,
                        x: currX,
                        className: getClass(value),
                        height: barHeight,
                        y: yMargin/2,
                        value: value
                    }
                    currX += currWidth;
                    ratioBarData.push(entry)
                }
                addEntry(forCount, 1);

                if(ratioVar === 'sentiment'){
                    addEntry(againstCount, -1);
                    addEntry(data.total_tweets - againstCount - forCount, 0);
                } else{
                    addEntry(againstCount, 0);
                }
                currX += barSpacing;
            }

            d3.select(d3Container.current).select('svg').selectAll('g').filter('.ratioVarGroup').remove();
            var ratioVarRectGroup = d3.select(d3Container.current).select('svg').append('g')
                .attr('class','ratioVarGroup');

            let getTipName = function(d){
                if(d.className.includes('default')){
                    return Utils.getVarDisplayName(d.varName, d.value);
                } else{
                    return d.className;
                }
            }
            var ratioVarRects = ratioVarRectGroup.selectAll('rect').filter('.ratioVarRect')
                .data(ratioBarData).enter()
                .append('rect')
                .attr('class', d=> d.className + ' ratioVarRect')
                .attr('x', d=>d.x)
                .attr('y', d=>d.y)
                .attr('width', d=>d.width)
                .attr('height', d=>d.height)
                .attr('stroke-width', 0)
                .on('mouseover', function(e){
                    let d = d3.select(this).datum();
                    let tipText = getTipName(d) + '</br>'
                        + 'total: ' + d.count + '/' + d.total +' (' + 100*(d.count/d.total).toFixed(2) + '%)';
                    tTip.html(tipText)
                }).on('mousemove', function(e){
                    Utils.moveTTip(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            ratioVarRects.exit().remove();
            setSvgDrawn(true);
        }
    },[data, svgCreated, appProps.selectedDemographics, selectedFrame])

    useEffect(function brushCluster(){
        if(data.group_num === undefined || !svgDrawn){ return; }
        let svgClass = (appProps.brushedCountyGroupNum == data.group_num)? ' activeClusterSvg':'';
        d3.select(d3Container.current).select('svg')
            .attr('class', 'frameEntryD3' + svgClass)
            .on('click', function(){
                if(data.group_num !== appProps.brushedCountyGroupNum){
                    appProps.setBrushedCountyGroupNum(data.group_num);
                } else{
                    appProps.setBrushedCountyGroupNum(-1);
                }
            });
    },[appProps.brushedCountyGroupNum, svgDrawn])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}