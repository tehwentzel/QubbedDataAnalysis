import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function FeatureEffectViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const xMargin = 10;
    const yMargin = 10;
    const barMargin = 2;
    const useChange = true;

    useEffect(function draw(){
        if(svg !== undefined & props.effectData !== undefined){
            const data = props.effectData;
            const maxWidth = (width - 2*xMargin)/(data.length)
            const maxHeight = (height - 2*yMargin);
            
            const metric = props.colorMetric;
            var metricTransform = x => -x;
            if(metric.includes('pval')){
                metricTransform = x => -(1/x);
            }
            var getValue = (d) => {
                if(d === undefined){
                    return undefined;
                } else if(d[metric] === undefined){
                    return undefined;
                }
                let v = d[metric];
                let baselineValue = d[metric+'_base']
                if(useChange &  baselineValue !== undefined){
                    v = v - baselineValue;
                }
                return metricTransform(v)
            }

            
            const [minVal,maxVal] = d3.extent(data, getValue);
            let colorScale = d3.scaleLinear()
                .domain([minVal,maxVal])
                .range([0,1])
            let interp = props.linearInterpolator;

            if(minVal < 0){
                colorScale = d3.scaleDiverging()
                    .domain([minVal,0,maxVal])
                    .range([0,.5,1])
                interp = props.divergentInterpolator;
            }
            const getColor = (val) =>{
                return interp(colorScale(val))
            }

            let xPos = xMargin;
            let entries = [];
            const keys = [
                'aic_diff','aic_diff_base',
                'bic_diff','bic_diff_base',
                'lrt_pval','lrt_pval_base',
                'featurePos','features',
                'cluster','symptom',
            ]
            for(let d of data){
                let val = getValue(d);
                let entry = {
                    'x': xPos,
                    'y': yMargin,
                    'height': maxHeight,
                    'width': maxWidth-barMargin,
                    'value': val,
                    'color': getColor(val),
                    'name': 'V' + d.featurePos,
                }
                for(let key of keys){
                    if(d[key] !== undefined){
                        entry[key] = d[key];
                    }
                }
                entries.push(entry);
                xPos = xPos + entry.width + barMargin;
            }

            const getStroke = d => (props.clusterFeatures.indexOf(d.name) >= 0)? barMargin:.01;

            svg.selectAll('rect').filter('.dvhRect').remove();
            svg.selectAll('rect').filter('.dvhRect')
                .data(entries).enter()
                .append('rect').attr('class','dvhRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('height',d=>d.height)
                .attr('width',d=>d.width)
                .attr('fill',d=>d.color)
                .attr('stroke', 'black')
                .attr('stroke-width',getStroke)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = '';
                    for(let key of keys){
                        if(d[key] !== undefined){
                            tipText += key + ': '+ d[key] + '</br>';
                        }
                    }
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });;

            const fontsize = Math.min(maxWidth/3,maxHeight/2)
            svg.selectAll('text').filter('.dvhText').remove();
            svg.selectAll('text').filter('.dvhText')
                .data(entries).enter()
                .append('text').attr('class','dvhText')
                .attr('x',d=>d.x + (fontsize/2))
                .attr('y',d=>d.y+(d.height/2))
                .attr('font-size',fontsize)
                .html(d=>d.name);
        }
    },[svg,props])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}