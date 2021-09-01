import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';
import legend from 'd3-svg-legend';
import * as constants from '../../modules/Constants.js';

export default function TimelineViewD3({data, rtTransform, brushedCountyGeoid, setBrushedCountyGeoid, activeOnly, selectedFrame, legendWidth, appProps}){
    const d3Container = useRef(null);

    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const [svgCreated,setSvgCreated] = useState(false);
    const [timelineDrawn, setTimelineDrawn] = useState(false)

    const yMargin = 10;
    const xMargin = 10;

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

    useEffect(function drawTimeline(){
        if (data && svgCreated) {
            const tData = data['data'];
            if(tData === undefined){
                return
            }

            const maxCpcDiscrete = data['max_cases_per_capita_discrete'];
            const maxCpc = data['max_cases_per_capita'];

            const tlineWidth = width - legendWidth;
            const barWidth = tlineWidth/tData.length;

            var filterTweets;
            if(activeOnly){
                filterTweets = x => (parseInt(x[selectedFrame]) === 1);
            } else{
                filterTweets = x => (parseInt(x[selectedFrame]) !== undefined);
            }
            const [maxRtDiscreteFor, maxRtDiscreteAgainst] = getRtExtents(data, filterTweets);

            var xAxisCenter = (height - 2*yMargin)*maxRtDiscreteFor/(maxRtDiscreteFor + maxRtDiscreteAgainst);

            var casesInterpolator = appProps.colorManager.getInterpolator('cases');
            var caseScale = d3.scalePow(.25)
                .domain([0, maxCpcDiscrete])
                .range([0, 1])
            var getTweetColor = x => casesInterpolator(caseScale(x.cases_per_capita_discrete));

            var getXPos = x => (x.pos)*barWidth;
            //scale tweet bars so it fills up the space perfectly
            var maxBarHeight = (height - 3*yMargin)/(maxRtDiscreteFor + maxRtDiscreteAgainst);
            //cap the size of the bar or it gets weird
            maxBarHeight = Math.min(maxBarHeight, height*.04);
            var getBarHeight = x => (x+1)*maxBarHeight;
            //all the data
            var formattedTweets = [];

            //save the start and end value so I can draw an axis later
            let startX = -1;

            //track the heights so I can fix the final height of the thing
            for(const block of tData){
                var xPos = getXPos(block);

                if(startX == -1){
                    startX = xPos;
                }
                
                var currYFor = xAxisCenter - yMargin/4;
                var currYAgainst = xAxisCenter + yMargin/4;
                let validTweets = block.tweets.filter(filterTweets);
                validTweets.sort((b,a) => (a.retweet_count - b.retweet_count));
                if(validTweets.length === undefined || validTweets.length === 0){
                    continue
                }

                for(const tweet of validTweets){
                    var color = getTweetColor(tweet);
                    var tHeight = getBarHeight(tweet.rt_discrete);
                    var tweetY;
                    if(parseInt(tweet.for_sah) === 1){
                        tweetY = currYFor-tHeight;
                        currYFor -= tHeight;

                    } else{
                        tweetY = currYAgainst;
                        currYAgainst += tHeight;
                    }
                    var frameString = '';
                    for(let f of constants.FRAMES){
                        if(parseInt(tweet[f]) == 1){
                            frameString += f + ', '
                        }
                    }
                    //remove trailing comma
                    frameString = frameString.substring(0, frameString.length - 2);

                    let entry = {
                        fill: color,
                        x: xPos,
                        y: tweetY,
                        height: tHeight,
                        width: barWidth,
                        text: tweet.text,
                        cases: tweet.cases,
                        pop: tweet.cvap,
                        geoid: parseInt(tweet['GEOID']),
                        county_name: tweet.county_name,
                        rtCount: tweet.retweet_count,
                        isVivid: tweet.is_vivid,
                        dateString: tweet.day + '/' + tweet.month + '/' + tweet.year,
                        frameString: frameString
                    };
                    formattedTweets.push(entry);
                
                }
                
            }
            svg.selectAll('g').filter('.timelineGroup').remove()

            //shift the rects up a little bit so it hits the top of the svg
            var tweetRectGroup = svg.append('g')
                .attr('class', 'timelineGroup'); 
            var tweetRects = tweetRectGroup.selectAll('rect')
                .filter('.tweetRect')
                .data(formattedTweets).enter()
                .append('rect')
                .attr('class','tweetRect')
                .attr('x', x=>x.x)
                .attr('y', x=>x.y)
                .attr('height',x=>x.height)
                .attr('width', x=>x.width)
                .attr('fill',x=>x.fill)
                .on('mouseover', function(e){
                    let d = d3.select(this).datum();
                    //toolitp text for each tweet
                    let tipText = 'Text: ' + d.text 
                        + '</br>' + '#Retweets: ' + d.rtCount
                        + '</br>' + 'County: ' + d.county_name
                        + '</br>' + 'Date: ' + d.dateString
                        + '</br>' + 'Moral Frames: ' + d.frameString;
                    tTip.html(tipText)
                }).on('mousemove', function(e){
                    Utils.moveTTip(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            tweetRects.exit().remove();

            //draw the center line
            let originEndpoints = [startX, barWidth*tData.length]
            const drawOrigin = function(className, offset){
                svg.selectAll('path').filter('.' + className+'Line').remove();
                let hLine = d3.line()
                    .x(x => x)
                    .y(x => xAxisCenter + offset)
                let line = svg.append('path')
                    .datum(originEndpoints)
                        .attr('class',className+'Line')
                        .attr('stroke-width',yMargin/4)
                        .attr('stroke',appProps.colorManager.getInterpolator(className)(.8))
                        .attr('d',hLine);
            }
            drawOrigin('forSah',yMargin/6)
            drawOrigin('againstSah',-yMargin/6);
            

            //Code for the legend
            const legendPadding = 5;
            const nCells = 4;
            const lngdWidth = legendWidth/(nCells+1) - legendPadding;

            //shape legend is weird when there are diferent number of tweets so this is just tuned to work
            const minLegendHeight = height *.1
            const defaultBarHeight = (getBarHeight(0) > minLegendHeight)? getBarHeight(0): getBarHeight(1);

            var legendScale = d3.scalePow(.5)
                .domain([.01*maxCpcDiscrete, maxCpcDiscrete])
                .range([casesInterpolator(.01*maxCpcDiscrete), casesInterpolator(1)])
            
            var setLegend = g => g
                .shapeWidth(lngdWidth)
                .shapePadding(legendPadding)
                .cells(nCells)
                .labelWrap(lngdWidth)
                .labelOffset(Math.min(defaultBarHeight + 7, 10))
                .orient('horizontal')
                .titleWidth(legendWidth-legendPadding);

            var cLgnd = legend.legendColor()
                .scale(legendScale)
                .shape('rect')
                .shapeHeight(defaultBarHeight)
                .title('County Cases(%)');

            setLegend(cLgnd);

            var heightScale = d3.scaleLinear()
                .domain([0,2])
                .range([getBarHeight(0),getBarHeight(2)]);

            var shapeLgnd = legend.legendSize()
                .scale(heightScale)
                .shape('line')
                .shapePadding(legendPadding * (nCells/3))
                .title("Tweet Retweets");

            setLegend(shapeLgnd);

            //correct for the fact that there are only 3 possible heights at time of writting
            shapeLgnd
                .cells(3)
                .shapeWidth(lngdWidth*(nCells/3))
                .labels(['0','1-9','10+']);

            var sentimentLgnd = legend.legendColor()
                .scale(appProps.colorManager.getSentimentColorScale())
                .shape('rect')
                .shapeHeight(defaultBarHeight)
                .orient('horizontal')
                .title('Avg. Sentiment');

            setLegend(sentimentLgnd);

            svg.selectAll('.legend').remove();

            let xLegendPos = tlineWidth + .5*barWidth;
            let yColorLegendPos = yMargin;

            let legendYOffset =  yMargin + getBarHeight(3);
            legendYOffset = Math.min(legendYOffset, height/4);

            var legendGroup = svg.append('g')
                .attr('class','legend');

            svg.selectAll('.colorLegend').remove();
            legendGroup.append('g')
                .attr('class','colorLegend')
                .attr('transform', 'translate(' + xLegendPos + ',' + yColorLegendPos + ')')
                .call(cLgnd);

            let yShapeLegendPos = d3.select('.colorLegend').node().getBoundingClientRect().y  + legendYOffset;
            svg.selectAll('.shapeLegend').remove();
            legendGroup.append('g')
                .attr('class','shapeLegend')
                .attr('transform', 'translate(' + xLegendPos + ',' + yShapeLegendPos + ')')
                .call(shapeLgnd);
            
            let ySentimentLegendPos = d3.select('.shapeLegend').node().getBoundingClientRect().y  + legendYOffset;
            svg.selectAll('.sentimentLegend').remove();
            legendGroup.append('g')
                .attr('class','sentimentLegend')
                .attr('transform', 'translate(' + xLegendPos + ',' + ySentimentLegendPos + ')')
                .call(sentimentLgnd);
            
            setTimelineDrawn(true);
        }
    },[data, svg, selectedFrame,height,width,activeOnly])

    useEffect(()=>{
        if (data && timelineDrawn) {
            var getClass = function(tweet){
                if(brushedCountyGeoid < 0){ return 'tweetRect';}
                let geoid = parseInt(tweet.geoid);
                if(geoid === parseInt(brushedCountyGeoid)){
                    return 'tweetRect tweetRectActive';
                } else{
                    return 'tweetRect';
                }
            }
        
            var tRects = svg.selectAll('.tweetRect')
                .attr('class', d=>getClass(d))
                .on('dblclick', function(e){
                    let d = d3.select(this).datum();
                    let brushedCounty = d.geoid === brushedCountyGeoid? -1: d.geoid;
                    setBrushedCountyGeoid(brushedCounty);
                });
        

        }
    },[timelineDrawn, selectedFrame, brushedCountyGeoid,activeOnly])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}


  

function getRtExtents(d, filterFunc){
    var maxFor = 0;
    var maxAgainst = 0;
    for(const block of d.data){
        let tweets = block.tweets.filter(filterFunc);
        let currFor = 0;
        let currAgainst = 0;
        for(const tweet of tweets){
            if(tweet.for_sah === 1){
                currFor += tweet.rt_discrete + 1;
            } else{
                currAgainst += tweet.rt_discrete + 1;
            }
        }
        maxFor = Math.max(maxFor, currFor);
        maxAgainst = Math.max(maxAgainst, currAgainst);
    }
    return [maxFor, maxAgainst]
}