import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Dose2dCenterViewD3 from './Dose2dCenterViewD3.js';
import ClusterSymptomsD3 from './ClusterSymptomsD3.js';
import PatientDoseViewD3 from './PatientDoseViewD3.js';

import Spinner from 'react-bootstrap/Spinner';

export default function PatientDoseView(props){
    const ref = useRef(null)

   
    const [svgPaths,setSvgPaths] = useState();

    //temp limit on number of patients we plot
    //add in some sort of toggle or something here?
    const maxPatients = 10;

    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    const [compareVizComponents,setCompareVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )



    useEffect(()=>{
        fetch('organ_svgs/organ_svg_paths.json').then((newPaths)=>{
            newPaths.json().then((data)=>{
                setSvgPaths(data);
            })
        })
    },[])

    useEffect(function drawPatients(){
        // console.log('organs',props.clusterOrgans)
        function makePatientPlot(d,i,canClick=true,baseline){
            let title = "ID:" + d.id;
            let trueString = d => (parseInt(d)>0)? '+':'-';
            let bottomTitle = d.t_stage + '|' + d.n_stage + '|hpv' +trueString(d.hpv) + '|' + d.subsite + '|rt' + trueString(d.rc) + '|ic' + trueString(d.ic);
            let handlePatientSelect = (pid) => {
                if(!canClick){ return; }
                let p = parseInt(pid);
                if(parseInt(props.selectedPatientId) !== p){
                    props.setSelectedPatientId(p);
                }
            }
            let active = parseInt(d.id) == parseInt(props.selectedPatientId);
            // active = (active & canClick)
            let variant = active? 'dark': 'outline-secondary';
            let getColor = d3.interpolateReds;
            if(baseline !== undefined){
                getColor = d3.interpolateGnBu;
            }
            return (
                <Container style={{'height':'10vh','width': '20vh','marginTop': '3em'}} 
                    className={'inline'} key={i+props.plotVar+canClick} md={5}>
                    <span  className={'controlPanelTitle'}>
                        <Button
                            title={title}
                            value={d}
                            variant={variant}
                            disabled={active}
                            onClick={(e)=>handlePatientSelect(d.id)}
                        >{title}</Button>
                    </span>
                    <PatientDoseViewD3
                        data={d}
                        key={i+''+props.activeCluster}
                        plotVar={props.plotVar}
                        svgPaths={svgPaths}
                        orient={'both'}
                        getColor={getColor}
                        baseline={baseline}
                    ></PatientDoseViewD3>
                    <span  className={'controlPanelTitle'}>
                        <Button
                            title={bottomTitle}
                            value={d}
                            variant={''}
                            disabled={true}
                        >{bottomTitle}</Button>
                    </span>
                </Container>
            )
        }

        if(props.doseData !== undefined & svgPaths != undefined & props.clusterData != undefined){

            console.log(props.doseData);
            let activeIds = props.clusterData.filter(x => x.clusterId == props.activeCluster).map(x=>x.ids)[0];
            // let activeData = props.doseData.filter(x => activeIds.indexOf(parseInt(x.id)) > -1);
            //get data in selected cluster
            let activeData = [];
            let badPids = [];
            for(let pid of activeIds){
                if(activeData.length > maxPatients){ break; }
                let datum = props.doseData.filter(x=>parseInt(x.id) === parseInt(pid));
                if(datum !== undefined){
                    activeData.push(datum[0])
                }else{
                    badPids.push(pid);
                }
                
            }
            if(badPids.length > 0){
                console.log('bad pids',badPids.length,'out of',activeIds.length);
            }
            //sort by highest dose at top
            activeData.sort((a,b)=> b.totalDose - a.totalDose);
            
            let components = activeData.map(makePatientPlot);

            //data for second column
            let toCompare = parseInt(props.selectedPatientId);
            if(toCompare === undefined | toCompare < 0){
                toCompare = parseInt(activeData[0].id);
            }
            let selectedData = props.doseData.filter(x => parseInt(x.id) === toCompare)[0];
            let compareCandidates = props.doseData.filter(x => activeIds.indexOf(x.id) == -1);
            let counterfactuals = getSimilarPatients(selectedData,compareCandidates);
            if(counterfactuals.length > maxPatients){
                counterfactuals = counterfactuals.slice(0,maxPatients);
            }
            console.log('coounterfactual',counterfactuals);
            let compareComponents = counterfactuals.map((d,i) => {
                let datum = d.datum;
                return makePatientPlot(datum,i,false,selectedData);
            })
            setVizComponents(components);
            setCompareVizComponents(compareComponents);

        } else{
            let temp = [1,1,1,1,1,1,1]
            let components = temp.map((d,i)=>{
                return (
                    <Spinner 
                    as="span" 
                    key={i}
                    animation = "border"
                    role='status'
                    className={'spinner'}/>
                )
            });
            setVizComponents(components);
            setCompareVizComponents(components.map(x=>x))
        }
    },[props.clusterData,svgPaths,props.clusterOrgans,props.plotVar,props.activeCluster,props.selectedPatientId])

    return ( 
        <div ref={ref} id={'patientDoseContainer'}>
            <Row md={12} style={{'height': '100vh','overflowY':'show'}} className={'noGutter fillSpace'}>
                <Col md={6} className={'noGutter scroll'}>
                    {vizComponents}
                </Col>
                <Col md={6} className={'noGutter scroll'}>
                    {compareVizComponents}
                </Col>
            </Row>
            
        </div> 
        )
}


function patientClinicalVector(d){
    let valMap = {
        't1': 1/4,
        't2': 2/4,
        't3': 3/4,
        't4': 4/4,
        'n2a': 1/2,
        'n2b': 1/2,
        'n2c': 2/2,
        'n3': 2/2,
    }
    function fromMap(v){
        let val = valMap[v];
        if(val === undefined){ val = 0; }
        return val
    }
    let tVal = fromMap(d.t_stage);
    let nVal = fromMap(d.n_stage);
    let hpvVal = parseInt(d.hpv);
    let ic = parseInt(d.ic);
    let rt = parseInt(d.rt);
    let concurrent = parseInt(d.concurrent);
    let bot = (d.subsite == 'BOT')? 1:0;
    let tonsil = (d.subsite == 'Tonsil')? 1:0;
    let totalDose = parseFloat(d.totalDose)/3500
    return [tVal,nVal,hpvVal,ic,rt,concurrent,bot,tonsil]
    // return [tVal,nVal,hpvVal,ic,rt,concurrent,bot,tonsil]
}

function patientSim(a,b){
    var dist = 0;
    for(let i in a){
        let diff = (b[i] - a[i])**2;
        dist += diff
    }
    dist = dist**.5;
    return 1/(1+dist)
}

function getSimilarPatients(sourcePatient,targetPatients){
    let source = patientClinicalVector(sourcePatient);
    let sims = []
    for(let t of targetPatients){
        let target = patientClinicalVector(t);
        let sim = patientSim(source,target);
        sims.push({'similarity':sim,'datum':t})
    }
    sims.sort((a,b) => b.similarity - a.similarity)
    return sims
}