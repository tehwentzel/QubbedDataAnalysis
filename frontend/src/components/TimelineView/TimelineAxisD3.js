import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';

export default function TimelineAxisD3({data, appProps,legendWidth}){
    const d3Container = useRef(null);

    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const [svgCreated,setSvgCreated] = useState(false);


    useEffect(function makeSvg(){
        if(data && d3Container.current){
            
            d3.select(d3Container.current).selectAll('svg').remove();

            var h = d3Container.current.clientHeight*.99;
            var w = d3Container.current.clientWidth;

            var canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('class','frameEntryD3')
                .attr('width',w)
                .attr('height',h);

            if(d3.select('body').select('.tooltip').empty()){
                d3.select('body').append('div')
                    .attr('class','tooltip')
                    .style('visibility','hidden');
            }
            var tip = d3.select('body').select('.tooltip');

            setHeight(h);
            setWidth(w);
            setSvg(canvas);
            setTTip(tip);
            setSvgCreated(true);
        }
    },[d3Container.current]);

    useEffect(function drawTimelineAxis(){
        if (data && svgCreated) {
            const tData = data['data'];
            if(tData == undefined){
                return
            }

            const tlineWidth = width - legendWidth;
            const barWidth = tlineWidth/tData.length;

            var getXPos = x => (x.pos)*barWidth;
            var colorScale = appProps.colorManager.getSentimentColorScale();
            var getColor = function(x){
                return colorScale(Math.sign(x)*(Math.abs(x)**.5));
            }
            var barHeight = height/3;

            var sentimentData = [];
            var toDateString = x => (x.start_date == x.end_date)? x.start_date:x.start_date + "-" + x.end_date;
            for(const tEntry of tData){
                var entry = {
                    sentiment: tEntry.avg_sentiment,
                    dateLabel: toDateString(tEntry),
                    shortDate: tEntry.end_date,
                    x: getXPos(tEntry),
                    color: getColor(tEntry.avg_sentiment),
                    width: barWidth
                }
                sentimentData.push(entry);
            }

            svg.selectAll('rect').filter('.sentimentRect').remove()
            var sentiments = svg.selectAll('rect').filter('.sentimentRect')
                .data(sentimentData)
            sentiments.enter()
                .append('rect')
                .attr('class', 'sentimentRect')
                .attr('x', x=>x.x)
                .attr('y', 0)
                .attr('height', barHeight)
                .attr('width', x=>x.width)
                .attr('fill',x=>x.color)
                .attr('stroke','black')
                .attr('stroke-width', 1.5)
                .on('mouseover', function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.dateLabel + '</br>'
                        + 'sentiment score: ' + d.sentiment.toFixed(4);
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTip(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            sentiments.exit().remove();

            //code to adjust for the fact that the dates have different lengths so otherwise they get stretched out weird
            const maxDateLen = 5;// mm/dd = 5 characters
            let getDateWidth = (v) => {
                let ratio = v.shortDate.length/maxDateLen;
                return v.width*.9*ratio;
            }
            let getDateX = (v) => {
                //place the text in the center of the brick
                let offSet = (5 - v.shortDate.length)/maxDateLen;
                offSet = offSet*barWidth/2;
                let pos = v.x;
                return offSet + pos;
            }

            svg.selectAll('text').filter('.timelineAxisText').remove();
            var axisText = svg.selectAll('text').filter('.timelineAxisText')
                .data(sentimentData)
                .enter()
                .append('text')
                .attr('class','timelineAxisText')
                .attr('x', getDateX)
                .attr('y', barHeight + 20)
                .attr('textLength', getDateWidth)
                .attr('lengthAdjust','spacingAndGlyphs')
                .html(x => x.shortDate)

            axisText.exit().remove()

            
        }
    },[data, svgCreated])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}