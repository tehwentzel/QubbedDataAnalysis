import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function DoseLegendD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const xMargin = 15;
    const yMargin = 10;
    const barMargin = 5;

    useEffect(function draw(){
        if(svg !== undefined & props.plotVar !== undefined & props.doseColor !== undefined){
            const steps = [1,props.maxDose*.25,props.maxDose*.5,props.maxDose*.75,props.maxDose];
            svg.selectAll('.legendRect').remove();
            svg.selectAll('.legendText').remove();

            
            if(props.vertical){
                const barHeight = (height - 2*yMargin)/(steps.length + 1);
                const fontSize = barHeight/2;
                const barWidth = Math.min(barHeight, width/2);
                var currY = yMargin + 2*barMargin;
                // var title = props.plotVar + ' (Gy)'
                var legendData = [];
                for(let v of steps){
                    let entry = {
                        y: currY,
                        color: props.doseColor(v/props.maxDose),
                        text: v.toFixed(0) + ' (Gy)',
                    }
                    legendData.push(entry);
                    currY += barHeight + barMargin;
                }

                
                svg.selectAll('.legendRect')
                    .data(legendData).enter()
                    .append('rect').attr('class','legendRect')
                    .attr('x',xMargin)
                    .attr('y',d=>d.y)
                    .attr('height',barHeight)
                    .attr('width',barWidth)
                    .attr('fill',d=>d.color)
                    .attr('stroke','black')
                    .attr('stroke-width',.5);

                
                svg.selectAll('.legendText')
                    .data(legendData).enter()
                    .append('text').attr('class','legendText')
                    .attr('x',xMargin + barMargin + barWidth)
                    .attr('y',d=>d.y + (barHeight/2))
                    .attr('text-align','start')
                    .attr('alignment-baseline','middle')
                    .attr('font-size',fontSize)
                    .attr('font-weight','bold')
                    .text(d=>d.text);
            } else{
                const fontSize = Math.max(height/2.5,15);
                const barHeight = (height- 2*yMargin);
                const barWidth = (width - 2*xMargin)/(steps.length) - barMargin;

                var currX = xMargin;
                // var title = props.plotVar + ' (Gy)'
                var legendData = [];
                for(let v of steps){
                    let entry = {
                        x: currX,
                        color: props.doseColor(v/props.maxDose),
                        text: props.plotVar + ' = ' + v.toFixed(0),
                        isDark: v/props.maxDose > .7,
                    }
                    legendData.push(entry);
                    currX += barWidth + barMargin;
                }

                svg.selectAll('.legendRect')
                    .data(legendData).enter()
                    .append('rect').attr('class','legendRect')
                    .attr('x',d=>d.x)
                    .attr('y',yMargin)
                    .attr('height',barHeight)
                    .attr('width',barWidth)
                    .attr('fill',d=>d.color)
                    .attr('stroke','black')
                    .attr('stroke-width',.5);

                
                svg.selectAll('.legendText')
                    .data(legendData).enter()
                    .append('text').attr('class','legendText')
                    .attr('x',d => d.x + barWidth/4)
                    .attr('y',barHeight/2 + yMargin)
                    .attr('text-align','start')
                    .attr('alignment-baseline','middle')
                    .attr('font-size',fontSize)
                    .attr('font-weight','bold')
                    .attr('fill', 'black')
                    .attr('stroke','white')
                    .attr('stroke-width',d=>d.isDark? .2:.1)
                    .text(d=>d.text);
            }
            }   
    },[svg,props])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}