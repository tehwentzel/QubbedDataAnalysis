import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function Dose2dCenterViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);

    const tipChartSize = [250,150];
    const tipDvhValues = [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80];

    function addClusterDvh(element, data,organ,nQuants,colorFunc){
        console.log('tooltip time',data,organ);
        element.selectAll('svg').remove();
        const margin = 3;
        const bottomMargin = 15;
        let [w,h] = tipChartSize;

        let tipSvg = element.append('svg')
            .attr('width',w)
            .attr('height',h)
            .style('background','white');

        //data comes in preset qunatiles for each "vX" entry
        //format it like row = qunatile, col = vX so nQuants x tipDvhValues.lenght
        let vals = [];
        for(let i = 0; i < nQuants; i++){
            vals.push([]);
        }
        //names of tipDvhValues
        let valNames = [];
        let maxV = 0;
        let minV = 100;
        for(let v of tipDvhValues){
            let oString = organ + '_V' + v;
            if(data[oString] !== undefined){
                let vv = data[oString];
                for(let i = 0; i < vv.length; i++){
                    let valentry = vals[i];
                    valentry.push(vv[i]);
                    vals[i] = valentry;
                    maxV = Math.max(maxV,vv[i]);
                    minV = Math.min(minV, vv[i])
                }
                valNames.push('V'+v);
            }
        }
        const tipXScale = d3.scaleLinear()
            .domain([0,vals[0].length])
            .range([margin,w-margin]);
        const tipYScale = d3.scaleLinear()
            .domain([0,maxV])
            .range([h-bottomMargin,margin])
        let paths = [];
        let lineFunc = d3.line();
        for(let vi in vals){
            let vList = vals[vi];
            let pointList = [];
            let meanVal = 0;
            for(let vvii in vList){
                let v = vList[vvii];
                meanVal += v;
                let x = tipXScale(vvii);
                let y =tipYScale(v);
                pointList.push([x,y])
            }
            meanVal /= vList.length;
            let pathEntry = {
                'path': lineFunc(pointList),
                'quant': parseInt(vi),
                'mean': meanVal,
            }
            paths.push(pathEntry)
        }

        let ticks = [];
        //show every other x point
        let isOdd = false;
        const fontSize = Math.min(13, Math.min(w,h)*.11);
        for(let i in valNames){
            if(isOdd){
                let entry = {
                    name: valNames[i],
                    x: tipXScale(i),
                    y: h - bottomMargin + fontSize,
                }
                ticks.push(entry)
            }
            isOdd = !isOdd;
        }
    
        tipSvg.selectAll('path').filter('.tTipDvhLine')
            .data(paths).enter()
            .append('path').attr('class','tTipDvhLine')
            .attr('d',d=>d.path)
            .attr('stroke-width',2)
            .attr('stroke',d=>colorFunc(.6*d.mean+40))
            .attr('fill','none');

        tipSvg.selectAll('text').filter('tipXAxis')
            .data(ticks).enter()
            .append('text').attr('class','tipXAxis')
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('text-anchor','middle')
            // .attr('textLength',(w-2*margin)/(vals[0].length/2) )
            .attr('font-size',fontSize)
            .html(d=>d.name)
        console.log('ttip values',paths)
    }

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
                if(!props.showContralateral & organ.includes('Rt_')){
                    continue;
                }
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
                let tY = (1-scale)*(bbox.y + bbox.height*.5);
                let tX = (1-scale)*(bbox.x + bbox.width*.5);
                transform =  'translate(' + tX + ',' + tY + ')' + transform;
                tform = transform;
            }
            transforms.push(tform);
            });

            organGroup.selectAll('.organPath').remove();

            var getColor = v => d3.interpolateReds(v/maxDVal)
            organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                .attr('transform',(d,i)=>transforms[i])
                .attr('fill', x=>getColor(x.dVal) )
                .attr('stroke','black')
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    addClusterDvh(tTip,props.data,d.organ_name,nQuants,getColor);
                    // let tipText = d.organ_name + '</br>' 
                    // + 'Quantile: ' + d.lowerRange.toFixed(1) + '% -' + d.upperRange.toFixed(1) + '%' + '</br>'
                    // + props.plotVar + ': ' + d.dVal.toFixed(1) + '</br>'
                    // + 'Mean Dose: ' + d.mean_dose.toFixed(1) + '</br>'
                    // + 'Volume: ' + d.volume.toFixed(2);
                    // tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                    tTip.selectAll().remove();
                });

            setPathsDrawn(true)
        }
    },[props.data,svg,props.svgPaths,props.plotVar,props.showContralateral])


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
            let box = svg.node().getBBox();
            let transform = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            transform += ' scale(' + width/box.width + ',' + (-height/box.height) + ')';
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