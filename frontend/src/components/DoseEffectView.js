import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Spinner from 'react-bootstrap/Spinner';

import DoseEffectViewD3 from './DoseEffectViewD3.js';
import FeatureEffectViewD3 from './FeatureEffectViewD3.js';

export default function DoseEffectView(props){
    const ref = useRef(null)

    const [colorMetric,setColorMetric] = useState('bic_diff');
    const [fPos,setFPos] = useState(0);
    const metricOptions = ['aic_diff','bic_diff','lrt_pval'];
    const fPosOptions = [-1,0,1];
    const linearInterpolator = d3.interpolateBlues;
    const divergentInterpolator = d3.interpolateGnBu;

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
                <Col md={10} className={'noGutter'} style={{'height':'45vh','width': '80%'}}>
                    {makeTitle('Effect of Adding/Removing Individual Organs')}
                    <Row md={12} className={'noGutter'} style={{'height': 'calc(45vh - 8vh - 1.5em)'}}>
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
                            linearInterpolator={linearInterpolator}
                            divergentInterpolator={divergentInterpolator}
                        ></DoseEffectViewD3>
                    </Row>
                    {makeTitle('Effect of Adding/Removing Features')}
                    <Row md={12} className={'noGutter'} style={{'height': 'calc(8vh - 1.5em)'}}>
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
                            linearInterpolator={linearInterpolator}
                            divergentInterpolator={divergentInterpolator}
                            clusterFeatures={props.clusterFeatures}
                        ></FeatureEffectViewD3>
                    </Row>
                </Col>
                <Col md={2} className={'noGutter'}>
                    {makeThresholdDropdown()}
                    {makeMetricDropdown()}
                    {makeToggleCluster()}
                    {/* {makeWindowToggle(props.additiveClusterResults.organ)} */}
                </Col>
            </Row>
        </div>
    )
}

