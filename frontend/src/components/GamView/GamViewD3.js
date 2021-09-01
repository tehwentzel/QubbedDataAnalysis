import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import Utils from '../../modules/Utils.js';
import '../../App.css';

export default function GamViewD3({data, height,selectedInput, brushedCounty,brushedCountyGeoid,selectedPredictor,appProps}){
    const d3Container = useRef(null);

    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const [svgCreated,setSvgCreated] = useState(false);

    const xMargin = 10;
    const yMargin = 10;
    const xAxisHeight = 30;
    const yAxisWidth = 40;
    const axisMargin = 5;

    const chartXMin = xMargin;
    const chartXMax = width - xMargin - yAxisWidth - axisMargin;
    const chartYMin = height - yMargin - xAxisHeight - axisMargin;
    const chartYMax = yMargin;
    

    useEffect(function makeSvg(){
        if(data && d3Container.current){
            d3.select(d3Container.current).selectAll('svg').remove();
            setSvgCreated(false);
            //this ones different because we need to calculate the height in the parent and pass it as a property
            const w = d3Container.current.clientWidth;

            const canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('class','frameEntryD3')
                .attr('width',w)
                .attr('height',height)
                .attr('background','grey');

            if(d3.select('body').select('.tooltip').empty()){
                d3.select('body').append('div')
                    .attr('class','tooltip')
                    .style('visibility','hidden');
            }
            const tip = d3.select('body').select('.tooltip');

            setWidth(w);
            setSvg(canvas);
            setTTip(tip);
            setSvgCreated(true);
        }
    },[d3Container.current, height]);

    useEffect(function drawGamChart(){
        if (svgCreated) {
            if(data === undefined || data.feature === ''){ return; }

            let x = data.x_values;
            let y = data.pdep_values;
            //lower and upper confidence intervals
            let yLower = data['pdep_quantile_0.05'];
            let yUpper = data['pdep_quantile_0.95'];

            let xScale = d3.scaleLinear()
                .domain(d3.extent(x))
                .range([chartXMin, chartXMax]);
            
            let yScale = d3.scaleLinear()
                .domain([d3.min(yLower), d3.max(yUpper)])
                .range([chartYMin, chartYMax]);
            
            svg.selectAll('path').remove();
            let shapeCurve = d3.select(d3Container.current).select('svg').append('g')
                .attr('class','shapeCurve');

            let linePoints = [];
            for(let i = 0; i < x.length; i++){
                let pointX = xScale(x[i]);
                let pointY = yScale(y[i]);
                let pointYLower = yScale(yLower[i]);
                let pointYUpper = yScale(yUpper[i]);
                linePoints.push({pointX: pointX, pointY: pointY, pointYLower: pointYLower, pointYUpper: pointYUpper})
            }
            //for if I want to change this
            let linefunc = d3.line;

            let makeLine = (yKey, lineClass) => {
                let l = linefunc()
                    .x(v => v.pointX)
                    .y(v => v[yKey]);
                
                shapeCurve.append('path')
                    .datum(linePoints)
                    .attr('class','gamLine ' + lineClass)
                    .attr('d', l);
            }

            //make the lines + 95% confidence intervals
            makeLine('pointY','centerLine');
            makeLine('pointYLower','lowerConfLine');
            makeLine('pointYUpper','upperConfLine');

            svg.selectAll('.gamOriginLine').remove();
            svg.append('line')
                .attr('class', 'gamOriginLine')
                .attr('x1', chartXMin)
                .attr('x2', chartXMax)
                .attr('y1', yScale(0))
                .attr('y2', yScale(0))
                .attr('stroke','lightblue')
                .attr('stroke-opacity', .5)
                .attr('stroke-width', 2);

            //draw axes
            try{
                svg.selectAll('.gamAxis').remove();
            
                const yAxis = d3.axisRight()
                        .ticks(5)
                        .scale(yScale);
                    
                const xAxis = d3.axisBottom()
                    .ticks(8)
                    .scale(xScale);

                const xAxisG = svg.append('g')
                    .attr('class','gamAxis')
                    .attr('transform', 'translate(' + (0) + ',' + (height - yMargin - xAxisHeight) + ')');

                xAxisG.call(xAxis);

                const yAxisG = svg.append('g')
                    .attr('class','gamAxis')
                    .attr('transform', 'translate(' + (width - xMargin - yAxisWidth) + ',' + (0) + ')');
                yAxisG.call(yAxis);
            } catch{
                console.log("error making axes");
            }
            

        }
    },[data, svg,]);

    useEffect(() => {
        //draw a vertical line for the county that is highlighted
        //only works once the map data is loaded
        if(!svgCreated){ return; }
        svg.selectAll(".brushedLine").remove();
        if(brushedCountyGeoid == -1 || brushedCounty === undefined || brushedCounty.GEOID === undefined){return;}
        const getBrushedValue = function(name,format=false){
            let bcd = brushedCounty;
            let bval = bcd[name];
            if(bval === undefined){
                if(name.includes('sentiment')){
                    bval = bcd['avg_sentiment'];
                } else if(name.includes('cases')){
                    bval = bcd['median_cases']/bcd['cvap'];
                } else if(name.includes('deaths')){
                    bval = bcd['median_deaths']/bcd['cvap'];
                } else if(name.includes('vivid')){
                    bval = bcd['avg_vivid'];
                } else if(name.includes('sah')){
                    bval = bcd['avg_for_sah'];
                } else if(name.includes('retweet')){
                    bval = bcd['avg_retweets'];
                } else if(name.includes('is_blue')){
                    return (bcd['net_dem_president_votes'] > 0)? 1:0;
                }
                else{
                    bval = null; 
                }
                if(format){ bval += ' (average)'; }
            }
            return bval;
        }

        let brushedXValue = getBrushedValue(selectedInput);
        let brushedYValue= getBrushedValue(selectedPredictor,true);
        //draw a line vertically here
        let xScale = d3.scaleLinear()
                .domain(d3.extent(data.x_values))
                .range([chartXMin, chartXMax]);
        let xPos = xScale(brushedXValue);
        
        svg.append('line')
            .attr('class', 'brushedLine')
            .attr("x1", xPos)
            .attr("x2", xPos)
            .attr("y1", chartYMin)
            .attr("y2",chartYMax)
            .on('mouseover', function(e){
                //toolitp text for each tweet
                let tipText = brushedCounty.county_name + ' County'
                + '</br>' + Utils.getVarDisplayName(data.feature) + ': ' + brushedXValue
                + '</br>' + Utils.getVarDisplayName(selectedPredictor) + ': ' + brushedYValue;
                tTip.html(tipText)
            }).on('mousemove', function(e){
                Utils.moveTTip(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            });
    },[brushedCounty,selectedInput, data, svg, selectedPredictor,brushedCountyGeoid])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}