import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import { greatestIndex } from 'd3';

export default function Dose2dCenterViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);

    useEffect(function draw(){
        var nQuants = 0;
        var maxDVal = 70;
        if(svg !== undefined & props.svgPaths !== undefined & props.data != undefined & height > 0 & width > 0){
            svg.selectAll('g').remove();
            svg.selectAll('path').remove();
            setPathsDrawn(false);
            let orient = props.orient;
            // if(props.orient == 'side'){
            //     orient='left';
            // }
            var paths = props.svgPaths[orient];
            let organList = Object.keys(paths)
            let pathData = [];
            for(let organ of organList){
                let key = organ + '_' + props.plotVar;
                let vals = props.data[key];
            

                if(vals === undefined){ continue; }

                if(nQuants == 0){
                    nQuants = vals.length;
                }
                let path = paths[organ];
                for(let i in vals){
                    let entry = {'path':path}
                    let scale =  Math.pow(.75,i);
                    entry.scale= scale;
                    entry.dVal = vals[i];
                    entry.transform = 'scale('+scale+','+scale+')';

                    //stuff for tooltip
                    entry.organ_name = organ;
                    entry.lowerRange = i*(100/vals.length);
                    entry.upperRange = entry.lowerRange + (100/vals.length);
                    entry[props.plotVar] = vals[i];
                    for(let subkey of ['mean_dose','volume']){
                        let skey = organ+'_'+subkey;
                        if(props.data[skey] !== undefined){
                            entry[subkey] = props.data[skey][i]
                        }
                    }
                    if(vals[i] > maxDVal){ maxDVal = vals[i]; }
                    pathData.push(entry)
                }
            }

            svg.selectAll('g').filter('.organGroup').remove();
            const organGroup = svg.append('g')
            .attr('class','organGroup');
            
            let organShapes = organGroup
            .selectAll('path').filter('.organPath')
            .data(pathData)
            .enter().append('path')
            .attr('class','organPath')
            .attr('d',x=>x.path)
            .attr('stroke-width',0);
        
            var transforms = [];
            d3.selectAll('.organPath').filter('path').each((d,i,j)=>{
            var tform = '';
            if(d.scale < 1 & j[i] !== undefined & j[i].getBBox() !== undefined){
                let bbox = j[i].getBBox();
                let scale = d.scale;
                let transform = 'scale('+scale+','+scale+') ';
                // console.log(props.orient,d3Container.current.offset());
                let tY = (1-scale)*(bbox.y + bbox.height*.5);
                let tX = (1-scale)*(bbox.x + bbox.width*.5);
                transform =  'translate(' + tX + ',' + tY + ')' + transform;
                tform = transform;
            }
            transforms.push(tform);
            });

            organGroup.selectAll('.organPath').remove();
            organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                .attr('transform',(d,i)=>transforms[i])
                .attr('fill', x=>d3.interpolateReds(x.dVal/maxDVal) )
                .attr('stroke','black')
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.organ_name + '</br>' 
                    + 'Quantile: ' + d.lowerRange.toFixed(1) + '% -' + d.upperRange.toFixed(1) + '%' + '</br>'
                    + props.plotVar + ': ' + d.dVal.toFixed(1) + '</br>'
                    + 'Mean Dose: ' + d.mean_dose.toFixed(1) + '</br>'
                    + 'Volume: ' + d.volume.toFixed(2);
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            setPathsDrawn(true)
        }
    },[props.data,svg,props.svgPaths,props.plotVar])


    useEffect(function brushSelected(){
        if(svg !== undefined & pathsDrawn){
            //doing this the easy way with classes makes the positions wronge for some reason
            var isActive = d => (props.clusterOrgans.indexOf(d.organ_name) > -1);
            var inCue = d => (props.clusterOrganCue.indexOf(d.organ_name) > -1);
            function getStrokeWidth(d){
                if(d.scale == 1){
                    if(isActive(d)){
                        return .4;
                    } 
                    if(inCue(d)){
                        return .3;
                    } else{
                        return .1;
                    }
                } 
                return 0
            }
            function getStrokeColor(d){
                if(isActive(d) & inCue(d)){ return 'black';}
                if(isActive(d)){ return 'blue'; }
                if(inCue(d)){ return '#525252'; }
                return '#969696';
            }
            svg.selectAll('.organPath')
                .attr('stroke-width',getStrokeWidth)
                .attr('stroke',getStrokeColor)
                .on('contextmenu',function(e){
                    e.preventDefault();
                    let d = d3.select(this).datum();
                    let organ = d.organ_name;
                    props.addOrganToCue(organ);
                });

            //this also breaks it and I have no idea why because this is an obscure approach
            // svg.selectAll('.organPath').filter(d=>isActive(d)).raise();
        }
    },[props.data,svg,pathsDrawn,props.clusterOrgans,props.clusterOrganCue])

    useEffect(()=>{
        if(svg !== undefined & pathsDrawn){
            console.log('drawing paths')
            let box = svg.node().getBBox();
            let transform = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            transform += ' scale(' + width/box.width + ',' + (-height/box.height) + ')';
            // console.log('transform',transform)
            svg.selectAll('g').attr('transform',transform);
        }
    },[props.data,svg,pathsDrawn]);

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}