import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';
import legend from 'd3-svg-legend';

/* Component template for d3 with react hooks from https://medium.com/@jeffbutsch/using-d3-in-react-with-hooks-4a6c61f1d102*/
export default function FrameViewLegendD3({appProps,lData}){
    /* The useRef Hook creates a variable that "holds on" to a value across rendering
       passes. In this case it will hold our component's SVG DOM element. It's
       initialized null and React will assign it later (see the return statement) */
    /* The useEffect Hook is for running side effects outside of React,
       for instance inserting elements into the DOM using D3 */
    const d3Container = useRef(null);

    const xSpacing =  0;

    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
   
    useEffect(function makeSvg(){
        if(d3Container.current){
            
            d3.select(d3Container.current).selectAll('svg').remove();

            var h = d3Container.current.clientHeight*.99;
            var w = d3Container.current.clientWidth*.99;
            h=1000
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
        }
    },[d3Container.current]);
    
    useEffect(
        function drawLegend(){
            if (lData && d3Container.current && svg !== undefined) {
                const w = (2/3)*width - 2*xSpacing;
                const ySpacing = 30;

                let drawLegend = function(entry, yPos){
                    let cName = entry.cName + 'FrameLegend';
                    svg.selectAll('.' + cName).remove();
                    let sScale = d3.scaleOrdinal()
                        .domain(entry.labels)
                        .range(entry.colors)

                    let g = svg.append('g')
                        .attr('class', cName)
                        .attr('transform', 'translate(' + xSpacing + ',' + yPos + ')');

                    let nCells = entry.colors.length;
                    let padding = 1;
                    let barWidth = w/(nCells);

                    let lgnd = legend.legendColor()
                        .shape('rect')
                        .shapeHeight(10)
                        .shapeWidth(barWidth)
                        .labelOffset(1)
                        .orient('horizontal')
                        .title(Utils.getVarDisplayName(entry.cName))
                        .titleWidth(w)
                        .shapePadding(padding)
                        .labelWrap(5)
                        .scale(sScale);

                    svg.select('.' + cName)
                        .call(lgnd);
                    return svg.selectAll('.' + cName)
                }

                let currY = ySpacing;
                for(let i in lData){
                    let selection = drawLegend(lData[i],currY);
                    currY = selection.node().getBoundingClientRect().y + ySpacing;
                }
            }
        },
        [lData,  d3Container.current, svg])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}