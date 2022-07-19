import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function DoseLegendD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const xMargin = 10;
    const yMargin = 1;
    const barMargin = 2;

    useEffect(function draw(){
        if(svg !== undefined & props.plotVar !== undefined & props.doseColor !== undefined){
            const steps = [1,props.maxDose*.33,props.maxDose*.66,props.maxDose];
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

            svg.selectAll('.legendRect').remove();
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

            svg.selectAll('.legendText').remove();
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
            }   
    },[svg,props])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}