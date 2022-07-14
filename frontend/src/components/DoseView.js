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
import ClusterClinicalD3 from './ClusterClinicalD3.js';

import Spinner from 'react-bootstrap/Spinner';


export default function DoseView(props){
    const ref = useRef(null)

   

    const [clusterVizComponents,setClusterVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )
    const [symptomPlotDate,setSymptomPlotDate] = useState(33);

    const clinicalPlotVars = ['t_stage','n_stage','hpv','is_male','subsite'];
    function makeToggleButton(value){
        let active = value === symptomPlotDate;
        let variant = active? 'dark':'outline-secondary';
        let onclick = (e) => setSymptomPlotDate(value);
        return (
            <Button
                title={value}
                value={value}
                style={{'width':'auto'}}
                variant={variant}
                disabled={active}
                className={'compactButton'}
                onClick={onclick}
            >{value + ' wks'}</Button>
        )
    }

    useEffect(function drawClusters(){
        if(props.clusterData != undefined & props.svgPaths != undefined){
            //the plot var in a key makes it redraw the whole thing or the plot transforms is messed up
            //if I fix that later I should remove that in the key
            var allClinicalVars = {};
            for(let varName of clinicalPlotVars){
                let uniqueValues = new Set();
                for(let entry of props.clusterData){
                    let values = entry[varName];
                    if(values === undefined){
                        console.log('missing var', varName);
                    } else{
                        for(let v of values){
                            if(v + '' === '0' | v === false){ continue; }
                            uniqueValues.add(v)
                        }
                    }
                }
                uniqueValues = Array.from(uniqueValues);
                uniqueValues.sort();
                allClinicalVars[varName] = uniqueValues;
            }
            let newComponents = props.clusterData.map((d,i) => 
            {
                // let topmargin = '3em';// (i == 0)? '1em': '2em';
                let clusterText = 'Cluster: ' + i + ' (n=' + d.cluster_size + ')';
                let onTitleClick = (e) => props.setActiveCluster(parseInt(d.clusterId));
                let clickableTitle = (parseInt(props.activeCluster) !== parseInt(d.clusterId));
                let variant = clickableTitle? 'outline-secondary': 'dark';
                let dotColor = props.categoricalColors(parseInt(d.clusterId));
                return (
                    // <Container md={12}  
                    //     fluid={'true'} 
                    //     flex={'true'}
                    //     className={'noGutter'} 
                    //     style={{'marginTop': topmargin,'display':'inline-block'}}  
                    //     key={i}
                    // >
                        <Row 
                            className={'clusterPlotCol'} 
                            md={6} 
                            key={i+'doses'+props.plotVar+props.showContralateral}
                        >
                            <Col md={12}
                                style={{'height': '2em!important'}}
                                className={'controlPanelTitle'}
                            >
                                <Button
                                    title={clusterText}
                                    value={d}
                                    onClick={onTitleClick}
                                    variant={variant}
                                    disabled={!clickableTitle}
                                >
                                    {clusterText}
                                    <span r={10} style={{'borderRadius':'70%','color':dotColor}}>{'⬤'}</span>
                                </Button>
                            </Col>
                            <Col md={12}
                                className={'clusterDoseContainer'}
                            >
                                <Dose2dCenterViewD3
                                    data={d}
                                    clusterOrgans={props.clusterOrgans}
                                    plotVar={props.plotVar}
                                    svgPaths={props.svgPaths}
                                    orient={'both'}
                                    addOrganToCue={props.addOrganToCue.bind(this)}
                                    clusterOrganCue={props.clusterOrganCue}
                                    setClusterOrganCue={props.setClusterOrganCue}
                                    showContralateral={props.showContralateral}
                                    showOrganLabels={props.showOrganLabels}
                                ></Dose2dCenterViewD3>
                            </Col>
                            
                        </Row>
                        // <Col  className={'noGutter inline clusterPlotCol'} md={3} 
                        // style={{'width': '24%!important'}}
                        // key={i+'symptoms'}>
                        //     <span  className={'controlPanelTitle'}>
                        //         {'Symptoms at'}
                        //         {makeToggleButton(13)}
                        //         {makeToggleButton(33)}
                        //     </span>
                        //     <ClusterSymptomsD3
                        //         data={d}
                        //         plotSymptoms={props.symptomsOfInterest}
                        //         mainSymptom={props.mainSymptom}
                        //         setMainSymptom={props.setMainSymptom}
                        //         minWeeks={symptomPlotDate}
                        //     ></ClusterSymptomsD3>
                        // </Col>
                        // <Col className={'inline noGutter clusterPlotCol'} md={3} 
                        // style={{'width': '24%!important'}}
                        // key={i+'clinical'}>
                        //     <span  className={'controlPanelTitle noGutter'}>
                        //         {'Clinical Feature Dist.'}
                        //     </span>
                        //     <ClusterClinicalD3
                        //         data={d}
                        //         plotValues={allClinicalVars}
                        //     >
                        //     </ClusterClinicalD3>
                        // </Col> 
                    // </Container>
                )
            })
            setClusterVizComponents(newComponents)
        } else{
            let newComponents = []
            for(let i = 0; i < props.nDoseClusters; i++){
                newComponents.push(
                    <Container  fluid={'true'} md={12} className={'noGutter inline fillSpace'} flex={'true'} key={i}>
                        <Spinner 
                            as="span" 
                            animation = "border"
                            role='status'
                            className={'spinner'}
                        />
                    </Container >
                )
            }
            setClusterVizComponents(newComponents)
        }
    },[props.clusterData,props.mainSymptom,
        props.svgPaths,props.clusterOrganCue,
        props.plotVar,props.activeCluster,
        symptomPlotDate,
        props.showOrganLabels,
        props.symptomsOfInterest,
        props.showContralateral,
    ])

    return ( 
        <div ref={ref} className={'noGutter'} >
            <Container id={'doseClusterContainer'} >
                {clusterVizComponents}
            </Container>
        </div> 
        )
}
