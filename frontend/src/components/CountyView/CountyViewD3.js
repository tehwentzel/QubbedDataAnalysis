import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import '../../App.css';
import Utils from '../../modules/Utils.js';
import { zoomTransform } from 'd3';

d3.selection.prototype.moveToFront = function() {
    //https://gist.github.com/trtg/3922684
    return this.each(function(){
    this.parentNode.appendChild(this);
    });
};

export default function CountyViewD3({data, colorMaker, appProps}){
    const d3Container = useRef(null);

    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();
    const [svgCreated,setSvgCreated] = useState(false);
    const [bordersDrawn, setBordersDrawn] = useState(false);
    const [tweetsDrawn, setTweetsDrawn] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    // const [currentTransform, setCurrentTransform] = useState();

    // const zoomed = function(e) {
    //     if(e === undefined){
    //         setCurrentTransform(d3.zoomIdentity);
    //         return;
    //     }
    //     var transform = e.transform;
    //     setCurrentTransform(transform);
    // }

    // const zoom = d3.zoom().on('zoom',zoomed);

    useEffect(function makeSvg(){
        if(data && d3Container.current){
            
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

    useEffect(function drawBorders(){
        if (data && svgCreated) {
            //frames, cases_per_capita_discrete (list), for_sah, is_blue (list?), is_vivid, retweet_count (list), group_num, total_tweets
            if(data.demographics === undefined){ return; }
            setBordersDrawn(false);
            var projection = d3.geoAlbersUsa()
                .scale(Math.min(width*1.5,height*2.2))
                .translate([width/2,height/2]);

            const path = d3.geoPath().projection(projection);

            const getPath = function(d){
                if(d === undefined){ return;}
                let geoid = geoidString(d.GEOID);
                var features = data.borders[geoid];
                if(features === undefined){ return; }
                return path(features);
            }


            var getClass = d => 'mapBorder';
            d3.select(d3Container.current).select('svg').selectAll('.mapGroup').remove();

            var borders = d3.select(d3Container.current).select('svg').append('g')
                .attr('class','mapGroup zoomable')
                .selectAll('path')
                .data(data.demographics)
                .enter()
                .append('path')
                .attr('class', getClass)
                .attr('d', getPath);


            borders.exit().remove();
            setBordersDrawn(true);
        }
    },[data, svg])

    useEffect(function drawTweets(){
        if (data && bordersDrawn) {
            
            if(data.demographics === undefined || !bordersDrawn){ return; }
            setTweetsDrawn(false);
            
            let counties = d3.select(d3Container.current).selectAll('.mapBorder');

            let patterns = [];
            counties.data().forEach(d => {
                var t = colorMaker.toTexture(d);
                patterns.push(t);
            });

            let getColor = (d,i) => {
                var t = patterns[i];
                svg.call(t);
                return t.url();
            }

            counties.attr('fill',getColor)
                .on('mouseover', function(e){
                    let d = d3.select(this).datum();
                    let frameTweet = d[appProps.selectedFrame];
                    let feature = d[appProps.mapVar];
                    let tipText = d.county_name
                    +'</br>' + 'Tweets w/ ' + appProps.selectedFrame + ': ' + frameTweet 
                    + '</br>' + Utils.getVarDisplayName(appProps.mapVar) + ': ' + feature;
                    tTip.html(tipText)
                }).on('mousemove', function(e){
                    Utils.moveTTip(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            
            // svg.call(zoom)
            // //disable panning
            //     .on("mousedown.zoom", null)
            //     .on("touchstart.zoom", null)
            //     .on("touchmove.zoom", null)
            //     .on('dblclick.zoom', null)
            //     .on("touchend.zoom", null);

            // svg.on('contextmenu',(e) => {
                // e.preventDefault();
                // //prvent context menu
                // //reset current zoom setting (weird otherwise)
                // svg.call(zoom.transform, d3.zoomIdentity);
                // //set current trnasform to null
                // zoomed();
            // });

            setTweetsDrawn(true);

        }
    },[data, bordersDrawn, appProps.selectedFrame, appProps.mapVar])

    useEffect(function brush(){
        if(!tweetsDrawn){return;}
        var getClass = function(c){
            if(appProps.brushedCountyGeoid < 0){ return 'mapBorder';}
            if(c.GEOID!== undefined & parseInt(c.GEOID) === parseInt(appProps.brushedCountyGeoid)){
                return 'mapBorder mapBorderActive';
            } else{
                return 'mapBorder';
            }
        }

        d3.select(d3Container.current).selectAll('.mapGroup').selectAll('path')
                .attr('class',getClass)
                .on('dblclick', function(e){
                    let d = d3.select(this).datum();
                    let brushedCounty = d.GEOID === appProps.brushedCountyGeoid? -1: d.GEOID;
                    appProps.setBrushedCountyGeoid(brushedCounty);
                });

        let activeCounty = d3.select(d3Container.current).selectAll('.mapBorderActive')
        activeCounty.moveToFront();

        //this is a really not-nice way of centering on the selected County

        const zoomBorder = function(d){
            if(d === undefined || d[0] === undefined){ return; }
            d = d[0];
            console.log('data',d);
            let projection = d3.geoAlbersUsa()
                .scale(Math.min(width*1.5,height*2.2))
                .translate([width/2,height/2]);

            let path = d3.geoPath().projection(projection);
            let pathString = data.borders[geoidString(d.GEOID)];
            let b = path.bounds(pathString);
            let dx = b[1][0] - b[0][0];
            let dy = b[1][1] - b[0][1]
            let x = ( b[0][0] + b[1][0] )/2;
            let y = ( b[0][1] + b[1][1] )/2;
            let scale = isZoomed? (.2 / Math.max(dx / width, dy / height)): 1;
            let translate = [width /2 - scale*x, height/2 - scale*y];
            svg.selectAll('.zoomable').attr("transform", "translate(" + translate + ")scale(" + scale + ")");
        }
        if(appProps.brushedCountyGeoid !== -1){
            zoomBorder(activeCounty.data());
        } else{
            //otherwise, reset the zooming
            svg.selectAll('.zoomable').attr('transform','')
        }
        //basically left click will toogle zooming in/out centered on selected county
        svg.on('contextmenu',(e) => {
            e.preventDefault();
            setIsZoomed(!isZoomed);
        });

    },[appProps.brushedCountyGeoid, tweetsDrawn, isZoomed])

    // useEffect(function setZoom(){
    //     if(!tweetsDrawn){return;}
    //     if(currentTransform !== undefined){
    //         let selection = svg.selectAll('.zoomable');
    //         selection.attr('transform',currentTransform);
    //     }
        
    // },[tweetsDrawn, currentTransform])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}

function geoidString(g){
    let gInt = parseInt(g);
    if(gInt < 10000){
        return '0' + gInt;
    } else{
        return '' + gInt;
    }
}