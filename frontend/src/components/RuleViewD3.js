import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function RuleViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    useEffect(function draw(){
        if(svg !== undefined & props.svgPaths !== undefined & props.rule !== undefined){
            console.log('rule',props.rule)
            svg.attr('background','blue')
        }
    },[props.data,svg,props.svgPaths,props.plotVar])


    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}