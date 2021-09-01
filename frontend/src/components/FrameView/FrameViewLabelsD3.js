import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';

/* Component template for d3 with react hooks from https://medium.com/@jeffbutsch/using-d3-in-react-with-hooks-4a6c61f1d102*/
export default function FrameViewLabelsD3(props){
    /* The useRef Hook creates a variable that "holds on" to a value across rendering
       passes. In this case it will hold our component's SVG DOM element. It's
       initialized null and React will assign it later (see the return statement) */
    /* The useEffect Hook is for running side effects outside of React,
       for instance inserting elements into the DOM using D3 */
    const d3Container = useRef(null);

    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const textRotationDegrees = 0;
   
    useEffect(function makeSvg(){
        if(props.lData, d3Container.current){
            
            d3.select(d3Container.current).selectAll('svg').remove();

            var h = d3Container.current.clientHeight*.99;
            var w = d3Container.current.clientWidth*.99;

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
        function drawLabels(){
            if (props.lData && d3Container.current && svg !== undefined) {

                //the position here assumes text-anchor and alignment-baseline are both the center
                const lData = props.lData;
                svg.selectAll('text').remove();

                let minWidth = d3.min(lData, d => d.width);
                let maxTextLength = d3.max(lData, d => Utils.getVarDisplayName(d.cName).length);
                let minCharWidth = minWidth/maxTextLength;
                let textBottom = .7*height - (Math.abs(Math.sin(textRotationDegrees))*maxTextLength);
                let getTextWidth = (d) => {
                    let vSpace = Utils.getVarDisplayName(d.cName).length * minCharWidth;
                    return vSpace;
                }

                let isActive = (d) => {
                    return d.cName === props.sortVariable;
                }

                //draw rects for buttons
                svg.selectAll('rect').remove();
                const labelRects = svg.selectAll("rect")
                    .filter('.frameLabelRect')
                    .data(props.lData);

                let getRectWidth = d => {
                    let w = getTextWidth(d) + 20;
                    return Math.min(w, d.width);
                }

                let getRectX = d => {
                    return d.x + Math.abs((getRectWidth(d) - d.width)/2);
                }

                let getRectHeight = d => {
                    let h = Math.abs(getTextWidth(d)*Math.sin(textRotationDegrees));
                    return Math.min(.8*height, 20 + h);
                }

                let getRectY = d => {
                    return (height - getRectHeight(d))/2;
                }

                //this should in theory be in a seperate update (for when sortvar is updated)
                //but it wasn't working good
                let getRectClass = d => {
                    let c = 'frameLabelRect';
                    if(isActive(d)){
                        c += ' frameLabelActive';
                    }
                    return c;
                }

                labelRects.enter().append('rect')
                    .attr('class',getRectClass)
                    .attr('x', getRectX)
                    .attr('y',getRectY)
                    .attr('width', getRectWidth)
                    .attr('height',getRectHeight)
                    .on('click', function(){
                        let d = d3.select(this).datum();
                        props.setSortVariable(d.cName);
                    });

                labelRects.exit().remove();

                //draw the text
                let getTransform = (d)=>{
                    //makes the placement a transform so I can roate first
                    let xPos = d.x + d.width/2;
                    let yPos = textBottom*(3/4);
                    let t = 'translate(' + xPos + ',' + yPos + ')';
                    t += ' rotate(' + (-textRotationDegrees) + ',' + 0 + ',' + 0 +')';
                    return t;
                }

                const labelText = svg.selectAll('text')
                    .filter('.frameLabelText')
                    .data(props.lData);



                let getTextClass = d => {
                    let c = 'frameLabelText';
                    if(isActive(d)){
                        c += ' frameLabelActive';
                    }
                    return c;
                }
                    
                labelText.enter().append('text')
                    .attr('class', getTextClass)
                    .attr('transform',getTransform)
                    .attr('textLength',getTextWidth)
                    .attr('lengthAdjust','spacingAndGlyphs')
                    .html(d => Utils.getVarDisplayName(d.cName))
                    .on('click', function(){
                        let d = d3.select(this).datum();
                        props.setSortVariable(d.cName);
                    });


            }

        },
        [props.lData, d3Container.current, svg, props.sortVariable])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}
