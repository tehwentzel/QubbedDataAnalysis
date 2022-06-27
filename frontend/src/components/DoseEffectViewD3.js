import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function DoseEffectViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);
    const metric = 'bic_diff';
    const useChange = true;
    const metricTransform = x => -x;
    // console.log("dose effect",props,height,width)

    useEffect(function drawBorders(){
        console.log('additive', props.svgPaths,props.effectData, svg)
        if(svg !== undefined & props.svgPaths !== undefined & props.effectData !== undefined){
            console.log('drawborders')
            svg.selectAll('g').remove();
            svg.selectAll('path').remove();
            setPathsDrawn(false);

            var addedOrgans = props.effectData.map(d=>d.added_organs);
            var effectOrgans = new Set();
            for(let olist of addedOrgans){
                for(let organ of olist){
                    if(props.clusterOrgans.indexOf(organ) < 0) { effectOrgans.add(organ); }
                    // if(organ.includes('Rt_') | props.clusterOrgans.indexOf(organ) >= 0){
                    //     continue;
                    // } else{
                    //     effectOrgans.add(organ)
                    // }
                }
            }

            let dataSubset = props.effectData.filter(x=>x.symptom.includes(props.mainSymptom))
            
            var getDatapoint = (o) => {
                let d = dataSubset.filter(x=>x.added_organs.includes(o));
                return d[0];
            }

            var getValue = (d) => {
                if(d === undefined){
                    return undefined;
                } else if(d[metric] === undefined){
                    return undefined;
                }
                let v = d[metric];
                if(useChange & (d[metric+'_base'] !== undefined) ){
                    v = v - d[metric+'_base'];
                }
                return metricTransform(v)
            }

            let getClass = (d)=>{
                let cName = 'organEffectPath';
                if(!effectOrgans.has(d)){
                    cName += ' disabled';
                } 
                if(props.clusterOrgans.indexOf(d) >= 0){
                    cName += ' selected'
                }
                return cName
            }

            let paths = props.svgPaths['both'];
            let pathData = [];
            let [minVal,maxVal] = [10000000000,0]
            let organPaths = [];

            //get all relevant paths
            for(let organ of Object.keys(paths)){
                //skip paths with nubmers (inner stuff)
                let flag = (organPaths.indexOf(organ) == -1);
                if(flag){
                    for(let k of [1,2,3,4,5,6,7,8,9]){
                        flag = (flag & !organ.includes(k));
                    } 
                }
                if(flag){
                    organPaths.push(organ);
                }
            }
            // console.log('opaths',organPaths)
            for(let organ of organPaths){
                let entry = {
                    'path': paths[organ],
                    'classname': getClass(organ),
                    'organ': organ,
                }
                let dPoint = getDatapoint(organ);
                if(dPoint !== undefined){
                    let val = getValue(dPoint);
                    entry['value'] = val;
                    for(let k of Object.keys(dPoint)){
                        entry[k] = dPoint[k];
                    }
                    if(val !== undefined){
                        if(val > maxVal){ maxVal = val; }
                        if(val < minVal){ minVal = val; }
                    }
                }
                pathData.push(entry);
            }

            let colorScale = d3.scaleLinear()
                .domain([minVal,maxVal])
                .range([0,1])
            let interp = d3.interpolateBlues;
            // let inclusterInterp = d3.interpolateReds;

            if(minVal < 0){
                colorScale = d3.scaleDiverging()
                    .domain([minVal,0,maxVal])
                    .range([0,.5,1])
                interp = d3.interpolateGnBu;
                // inclusterInterp = d3.interpolatePiYG;
            }

            let getColor = (d)=>{
                //fix later to have actual colors
                let value = d.value;
                console.log(d.organ,props.clusterOrgans.indexOf(d.organ))
                if(value === undefined){
                    if(props.clusterOrgans.indexOf(d.organ) >= 0){
                        return 'red';
                    } else{
                        return 'grey';
                    }
                }
                // if(props.clusterOrgans.indexOf(d.organ) >= 0){
                //     return inclusterInterp(colorScale(value));
                // }
                return interp(colorScale(value))
            }

            svg.selectAll('g').filter('.organGroup').remove();
            const organGroup = svg.append('g')
                .attr('class','organGroup');
            
            organGroup.selectAll('.organPath').remove();

            const getStroke = d => (props.clusterOrgans.indexOf(d.organ) < 0)? 0.1:.6;
            const organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                .attr('fill', x=>getColor(x))
                .attr('stroke','black')
                .attr('stroke-width',getStroke)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = '';
                    let keys = ['organ','threshold','cluster','lrt_pval','aic_diff','bic_diff'];
                    for(let key of keys){
                        if(d[key] !== undefined){
                            tipText += key + ': '+ d[key] + '</br>';
                            let basekey = key+'_base'
                            if(d[basekey] !== undefined){
                                tipText += basekey + ': '+ d[basekey] + '</br>';
                            }
                        }
                    }
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            let box = svg.node().getBBox();
            let transform = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            transform += ' scale(' + width/box.width + ',' + (-height/box.height) + ')';
            organGroup.attr('transform',transform);
        }
    },[svg,props.svgPaths,props.effectData,props.clusterOrgans])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}