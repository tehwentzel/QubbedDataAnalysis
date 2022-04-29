import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import PatientScatterPlotD3 from './PatientScatterPlotD3.js';
import DoseEffectViewD3 from './DoseEffectViewD3.js';
import SymptomPlotD3 from './SymptomPlotD3.js';
import Spinner from 'react-bootstrap/Spinner';
import PatientDoseView from './PatientDoseView.js';
import ClusterMetricsD3 from './ClusterMetricsD3.js';

export default function OverView(props){
    const ref = useRef(null)

    const [viewToggle,setViewToggle] = useState('symptom')

    const [xVar,setXVar] = useState('dose_pca1');
    const [yVar, setYVar] = useState('dose_pca2');
    const [sizeVar, setSizeVar] = useState('drymouth');


    const symptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis'];
    //for x and y in the scatterplot
    const varOptions = [
        'dose_pca1','dose_pca2','dose_pca3',
        'symptom_all_pca1','symptom_all_pca2','symptom_all_pca3',
        'symptom_post_pca1','symptom_post_pca2','symptom_post_pca3',
        'symptom_treatment_pca1','symptom_treatment_pca2','symptom_treatment_pca3',
        'totalDose','tstage','nstage',
    ].concat(symptoms);
    //for shape stuff
    // const shapeOptions = [
    //     'tstage','nstage',
    // ].concat(symptoms)
    
    function makeDropdown(title,active,onclickFunc,key,options,dropDir){
        if(options === undefined){
            options = varOptions;
        }
        let buttonOptions = options.map((d,i)=>{
            return (
                <Dropdown.Item
                    key={i+key}
                    value={d}
                    eventKey={d}
                    onClick={() => onclickFunc(d)}
                >{d}</Dropdown.Item>
            )
        })
        return (
            <DropdownButton
             className={'controlDropdownButton'}
             style={{'width':'auto'}}
             drop={dropDir}
             title={title + ': ' + active}
             value={active}
             key={key}
             variant={'primary'}
            >{buttonOptions}</DropdownButton>
        )
    }

    function makeScatter(){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <Container className={'noGutter fillSpace'}>
                    <PatientScatterPlotD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        xVar={xVar}
                        yVar={yVar}
                        sizeVar={props.mainSymptom}
                        categoricalColors={props.categoricalColors}
                        svgPaths={props.svgPaths}
                        symptomsOfInterest={props.symptomsOfInterest}
                    ></PatientScatterPlotD3>
                </Container>
            )
        } else{
            return (<Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>
            );
        }
    }

    function makePatientDoses(showCounterfactuals){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <PatientDoseView
                    doseData={props.doseData}
                    clusterData={props.clusterData}
                    selectedPatientId={props.selectedPatientId}
                    setSelectedPatientId={props.setSelectedPatientId}
                    plotVar={props.plotVar}
                    clusterOrgans={props.clusterOrgans}
                    activeCluster={props.activeCluster}
                    svgPaths={props.svgPaths}
                    clusterFeatures={props.clusterFeatures}
                    symptomsOfInterest={props.symptomsOfInterest}
                    showCounterfactuals={showCounterfactuals}
                ></PatientDoseView>
            )
        }
    }

    function makeSymptomPlot(){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <Container className={'noGutter fillSpace'}>
                    <SymptomPlotD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        xVar={xVar}
                        yVar={yVar}
                        mainSymptom={props.mainSymptom}
                        sizeVar={sizeVar}
                        categoricalColors={props.categoricalColors}
                    ></SymptomPlotD3>
                </Container>
            )
        } else{
            return (<Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>
            );
        }
    }

    function makeEffectPlot(){
        if(props.clusterData != undefined & props.additiveClusterResults != undefined){
            return (
                <Container key={props.mainSymptom} className={'noGutter fillSpace'}>
                    <DoseEffectViewD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        effectData={props.additiveClusterResults}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        symptomsOfInterest={props.symptomsOfInterest}
                        mainSymptom={props.mainSymptom}
                        svgPaths={props.svgPaths}
                    ></DoseEffectViewD3>
                </Container>
            )
        } else{
            return (
                <Spinner 
                    as="span" 
                    animation = "border"
                    role='status'
                    className={'spinner'}/>
            )
        }
    }

    function makeMetricsPlot(){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <Container className={'noGutter fillSpace'}>
                    <ClusterMetricsD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        xVar={xVar}
                        yVar={yVar}
                        symptomsOfInterest={props.symptomsOfInterest}
                        mainSymptom={props.mainSymptom}
                        sizeVar={sizeVar}
                        categoricalColors={props.categoricalColors}
                    ></ClusterMetricsD3>
                </Container>
            )
        } else{
            return (<Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>
            );
        }
    }

    function switchView(view){
        if(view == 'scatterplot'){
            let buttonHeight = 30;
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'} >
                    <Col className={'noGutter fillHeight'} md={8}>
                        <Row md={12} className={'noGutter'} 
                            style={{'height':'calc(100% - '+buttonHeight+'px)'}} fluid={'true'}>
                            {makeScatter()}
                        </Row>
                        <Row md={12} className={'noGutter'} style={{'height': buttonHeight}}>
                            {makeDropdown('x-axis',xVar,setXVar,1,varOptions,'up')}
                            {makeDropdown('y-axis',yVar,setYVar,2,varOptions,'up')}
                        </Row>
                        
                    </Col>
                    <Col md={4} fluid={'false'} style={{'height':'100%','overflowY':'scroll'}}>
                        {makePatientDoses(false)}
                    </Col>
                </Row>
            )
        } 
        if(view == 'effect'){
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makeEffectPlot()}
                </Row>
            )
        } 
        if(view == 'symptom'){
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makeSymptomPlot()}
                </Row>
            )
        } 
        if(view == 'patients'){
            return(
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makePatientDoses(true)}
                </Row>
            )
        }
        if(view == 'metric'){
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makeMetricsPlot()}
                </Row>
            )
        }
        return (<Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>)
    }

    function makeToggleButton(value){
        let active = value === viewToggle;
        let variant = active? 'dark':'outline-secondary';
        let onclick = (e) => setViewToggle(value);
        return (
            <Button
                title={value}
                value={value}
                style={{'width':'auto'}}
                variant={variant}
                disabled={active}
                onClick={onclick}
            >{value}</Button>
        )
    }

    function makeSymptomDropdown(view){
        //there was an if statement before idk
        return makeDropdown(props.mainSymptom,true,props.setMainSymptom,10,props.symptomsOfInterest)
    }

    return ( 
        <div ref={ref} id={'doseClusterContainer'}>
            <Row md={12} style={{'height': '2.5em'}} className={'noGutter fillWidth'}>
                <Col md={8} className={'noGutter'}>
                    {makeToggleButton('scatterplot')}
                    {makeToggleButton('effect')}
                    {makeToggleButton('symptom')}
                    {makeToggleButton('patients')}
                    {makeToggleButton('metric')}
                </Col>
                <Col md={4}>
                    {makeSymptomDropdown(viewToggle)}
                </Col>
            </Row>
            <Row md={12} style={{'height': 'calc(100% - 3.5em)','width':'100%'}}>
                {switchView(viewToggle)}
            </Row>
        </div> 
        )
}
