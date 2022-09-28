import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import DoseEffectViewD3 from './DoseEffectViewD3.js';
import FeatureEffectViewD3 from './FeatureEffectViewD3.js';
import EffectViewLegendD3 from './EffectViewLegendD3.js';

export default function DoseEffectView(props){
    const ref = useRef(null)

    const [colorMetric,setColorMetric] = useState('bic_diff');
    const [fPos,setFPos] = useState(0);
    // const [colorScale,setColorScale] = useState(v=>v);

    const linearInterpolator = d3.interpolateBlues;
    const divergentInterpolator = d3.scaleDiverging().domain([0,.5,1]).range(['pink','white','rgb(100,149,237)']);
    const [extents,setExtents] = useState();

    const metricOptions = ['aic_diff','bic_diff','lrt_pval'];
    const fPosOptions = [-1,0,1];
    
    const [useChange,setUseChange] =  useState(true); //this encodes color as a change from baseline

    useEffect(()=>{
        //get data extents to share between things
        //I tried making this a constant getcolor thing but it doesn't work for some reason
        if(props.additiveClusterResults !== undefined){
            const metric = colorMetric;
            const data = props.additiveClusterResults.organ;
            
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
            setExtents([minVal,maxVal])    
        }
    },[props.additiveClusterResults,colorMetric]);

    function makeMetricDropdown(){
        var handleMetricChange = (m) => {
            if(colorMetric !== m){
                setColorMetric(m);
            }
        }
        const mOptions = metricOptions.map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    
                    onClick={e => handleMetricChange(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                // drop={'up'}
                className={'controlDropdownButton'}
                title={'Color: ' + colorMetric}
            >{mOptions}</DropdownButton>
        )
    }

    function makeThresholdDropdown(){
        var handleChange = (t) => {
            if(props.additiveClusterThreshold !== t){
                props.setAdditiveClusterThreshold(t);
            }
        }
        const tholds = [1,2,3,4,5,6,7,8,9,10].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    
                    onClick={e => handleChange(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                // drop={'up'}
                className={'controlDropdownButton'}
                title={'Target Threshold: ' + props.additiveClusterThreshold}
            >{tholds}</DropdownButton>
        )
    }

    function makeWindowToggleButton(value,name){
        let active = value === fPos;
        let variant = active? 'dark':'outline-secondary';
        let onclick = (e) => setFPos(value);
        return (
            <Button
                title={name}
                value={value}
                style={{'width':'auto'}}
                variant={variant}
                disabled={active}
                onClick={onclick}
            >{name}</Button>
        )
    }

    function makeWindowToggle(data){
        var fNames = [...fPosOptions];
        if(data !== undefined & data !== null){
            fNames = fPosOptions.map(d => {
                let vals = data.filter(x => parseInt(x.featurePos) == d);
                if(vals !== undefined & vals.length > 0){
                    return vals[0].features;
                }
                return d;
            })
        }
        const tButtons = fPosOptions.map((d,i) => {
            const fName = fNames[i];
            return makeWindowToggleButton(d,fName);
        })
        return (
            <Col md={12} className={'fillWidth'}
            >{tButtons}</Col>
        )
    }

    function makeToggleCluster(){
        var useAll = props.additiveCluster;
        return (
            <span>
                <Button
                    title={'all'}
                    variant = {useAll? 'dark':'outline-secondary'}
                    disabled={useAll}
                    style={{'width':'50%','height':'2em'}}
                    onClick={()=>props.setAdditiveCluster(true)}
                >{'All'}</Button>
                <Button
                    variant = {useAll? 'outline-secondary':'dark'}
                    disabled={!useAll}
                    style={{'width':'50%','height':'2em'}}
                    onClick={()=>props.setAdditiveCluster(false)}
                >{"Clust " + (props.nDoseClusters-1)}</Button>
            </span>
        )
    }

    function makeTitle(text){
        return (
            <Row md={12} className={'noGutter'} style={{'height': '1.5em'}}>
                <span  className={'controlPanelTitle'}>
                    {text}
                </span>
            </Row>
        )
    }

    const addOrganToCue = (org)=>{
        //there is a version of this in App.js without the props parts
        //that need seperate updating
        if(props.clusterData !== undefined & org !== undefined & constants.ORGANS_TO_SHOW.indexOf(org) >= 0){
            let newCue = [];

            for(let o of props.clusterOrganCue){ newCue.push(o); }

            if(props.clusterOrganCue.length < 1 | props.clusterOrganCue.indexOf(org) < 0){
            newCue.push(org);
            props.setClusterOrganCue(newCue);
            } else{
            newCue = newCue.filter(x=>x!=org);
            props.setClusterOrganCue(newCue);
            }
        }
    }

    return (
        <div ref={ref} className={'noGutter fillSpace'}>
            <Row md={12} className={'noGutter fillSpace'}>
                <Col md={2} className={'noGutter'}>
                    <Row md={12} style={{'height': 'auto'}}>
                        {makeThresholdDropdown()}
                        {makeMetricDropdown()}
                        {makeToggleCluster()}
                        {/* {makeWindowToggle(props.additiveClusterResults.organ)} */}
                    </Row>
                    <Row md={12} style={{'height': '40%'}}>
                        <EffectViewLegendD3
                            colorMetric={colorMetric}
                            extents={extents}
                            linearInterpolator={linearInterpolator}
                            divergentInterpolator={divergentInterpolator}
                            useChange={useChange}
                        ></EffectViewLegendD3>
                    </Row>
                </Col>
                <Col md={10} className={'noGutter shadow fillHeight'}>
                    <Row md={12} 
                        className={'noGutter fillWidth'}
                        style={{'height': 'calc(95% - 8vh - 1em)'}}
                    >
                        <DoseEffectViewD3
                            doseData={props.doseData}
                            clusterData={props.clusterData}
                            effectData={props.additiveClusterResults.organ}
                            clusterOrgans={props.clusterOrgans}
                            activeCluster={props.activeCluster}
                            clusterOrganCue={props.clusterOrganCue}
                            addOrganToCue={addOrganToCue}
                            symptomsOfInterest={props.symptomsOfInterest}
                            mainSymptom={props.mainSymptom}
                            svgPaths={props.svgPaths}
                            additiveCluster={props.additiveCluster}
                            additiveClusterThreshold={props.additiveClusterThreshold}
                            setAdditiveCluster={props.setAdditiveCluster}
                            setAdditiveClusterThreshold={props.setAdditiveClusterThreshold}
                            colorMetric={colorMetric}
                            fPos={fPos}

                            extents={extents}
                            linearInterpolator={linearInterpolator}
                            divergentInterpolator={divergentInterpolator}
                            useChange={useChange}
                            showOrganLabels={props.showOrganLabels}
                        ></DoseEffectViewD3>
                    </Row>
                    {makeTitle('Effect of Adding/Removing Features')}
                    <Row md={12} className={'noGutter fillWidth'} style={{'height': 'calc(8vh - 1em)'}}>
                        <FeatureEffectViewD3
                            doseData={props.doseData}
                            clusterData={props.clusterData}
                            effectData={props.additiveClusterResults.features}
                            clusterOrgans={props.clusterOrgans}
                            activeCluster={props.activeCluster}
                            symptomsOfInterest={props.symptomsOfInterest}
                            additiveCluster={props.additiveCluster}
                            additiveClusterThreshold={props.additiveClusterThreshold}
                            setAdditiveCluster={props.setAdditiveCluster}
                            setAdditiveClusterThreshold={props.setAdditiveClusterThreshold}
                            colorMetric={colorMetric}
                            clusterFeatures={props.clusterFeatures}

                            extents={extents}
                            linearInterpolator={linearInterpolator}
                            divergentInterpolator={divergentInterpolator}
                            useChange={useChange}
                        ></FeatureEffectViewD3>
                    </Row>
                </Col>
                
            </Row>
        </div>
    )
}

