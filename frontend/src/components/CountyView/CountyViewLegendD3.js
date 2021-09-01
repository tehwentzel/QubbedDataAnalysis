import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';

d3.selection.prototype.moveToFront = function() {
    //https://gist.github.com/trtg/3922684
    return this.each(function(){
    this.parentNode.appendChild(this);
    });
};

export default function CountyViewLegendD3(props){
    const d3Container = useRef(null);

    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const [svgCreated,setSvgCreated] = useState(false);

    //relative values (0 = min, 1 = max) that we want to get the legend values for
    const legendValues = [0, .25, .75, .9];
    const secondaryValue = .1;
    const topMargin = 25;
    const ySpacing = 10;
    const xSpacing = 10;

    useEffect(function makeSvg(){
        if(props.data && d3Container.current){
            
            d3.select(d3Container.current).selectAll('svg').remove();

            //this ones different because we need to calculate the height in the parent and pass it as a property
            var w = d3Container.current.clientWidth;
            var h =  d3Container.current.clientHeight;
            var canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('width',w)
                .attr('height',h)
                .attr('background','grey');

            if(d3.select('body').select('.tooltip').empty()){
                d3.select('body').append('div')
                    .attr('class','tooltip')
                    .style('visibility','hidden');
            }
            var tip = d3.select('body').select('.tooltip');

            setWidth(w);
            setHeight(h);
            setSvg(canvas);
            setTTip(tip);
            setSvgCreated(true);
        }
    },[d3Container.current]);

    useEffect(function Legend(){
        if (props.data && svgCreated) {
            const colorMaker = props.colorMaker;
            const barHeight = (height - topMargin)/(2*(legendValues.length + 1)) - ySpacing;
            svg.selectAll('text').remove();

            function drawLegend(title, startY, pVals, sVals,usePrimary=true){

                let y = startY;
                let g = svg.append('g')
                    .attr('id', title + "mapTitle")
                    .attr('class', 'mapLegend');

                let titleText = g.append('text')
                    .attr('class', 'chartTitle')
                    .attr('x', width/2)
                    .attr('y', y)
                    .style('text-anchor', 'middle')
                    .html(Utils.getVarDisplayName(title));
                

                let titleLength = titleText.node().getComputedTextLength();
                if(titleLength > width){
                    titleText
                        .attr('textLength', .9*width)
                        .attr('lengthAdjust','spacingAndGlyphs');
                }
                
                y += ySpacing;

                let barValues = [];
                let i = 0;
                while(barValues.length < pVals.length){
                    let pV = pVals[i];
                    let sV = sVals[i];

                    let showValue; 
                    if(usePrimary){
                        showValue = colorMaker.primaryColorScale.invert(pV);
                    } else{
                        showValue = colorMaker.secondaryColorScale.invert(sV);
                    }

                    let pattern = colorMaker.valToTexture(pV, sV);
                    svg.call(pattern);
                    let entry = {
                        fill: pattern.url(),
                        y: y,
                        height: barHeight,
                        width: width/3,
                        value: showValue
                    }
                    barValues.push(entry);
                    y += barHeight + ySpacing;
                    i += 1;
                    
                }

                let cName = 'legendRect' + title;
                svg.selectAll('.' + cName).remove();
                let rects = svg.selectAll('rect').filter('.'+cName)
                    .data(barValues).enter()
                    .append('rect')
                    .attr('class', 'legendRect ' + cName)
                    .attr('x', xSpacing)
                    .attr('y', d => d.y)
                    .attr('width', d => d.width)
                    .attr('height', d => d.height)
                    .attr('fill', d => d.fill);


                let labelClass = 'rectText' + title
                let labels = svg.selectAll('text').filter('.'+labelClass)
                    .data(barValues);

                labels.enter()
                    .append('text')
                    .attr('class', 'rectText ' + labelClass)
                    .attr('x', d => { return d.width + 2*xSpacing;})
                    .attr('y', d => { return d.y + barHeight/2; } )
                    .style('alignment-baseline','middle')
                    .style('text-anchor', 'start')
                    .html(function(d,i){ return d.value.toFixed(2); });

                return y + topMargin;
            }

            var currYPos = topMargin;

            const staticArray = [];
            while(staticArray.length < legendValues.length){
                staticArray.push(secondaryValue);
            }
            currYPos = drawLegend(colorMaker.primaryVar, currYPos, legendValues, staticArray,true);
            currYPos = drawLegend(colorMaker.secondaryVar, currYPos, staticArray, legendValues,false);

        }
    },[props.data, svg,props.colorMaker.primaryVar, props.colorMaker.secondaryVar])



    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}
