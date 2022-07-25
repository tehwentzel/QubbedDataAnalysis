import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import ClusterMetricsD3 from './ClusterMetricsD3.js'
import Spinner from 'react-bootstrap/Spinner';


export default function ClusterMetrics(props){
    const ref = useRef(null)

    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    //I dont think I use this
    const [metricData,setMetricData] = useState(null);

    const [metricThresholds,setMetricThresholds] = useState([0,-1,5,-5]);

    var fetchMetrics = async(cData,dates,lrtConfounders,thresholds,symptoms)=>{
        if(cData !== undefined & !props.clusterDataLoading){
            setMetricData(undefined);
            props.api.getLRTests(cData,dates,lrtConfounders,thresholds,symptoms).then(response =>{
            // console.log('cluster metric data',response)
            setMetricData(response);
          }).catch(error=>{
            console.log('cluster metric data error',error);
          })
        }  
      }


    useEffect(()=>{
        if(!props.clusterDataLoading & props.clusterData !== undefined & props.clusterData !== null){
            fetchMetrics(props.clusterData,props.endpointDates,props.lrtConfounders,metricThresholds,[props.mainSymptom]);
        }
      },[props.clusterDataLoading,props.clusterData,props.mainSymptom,props.lrtConfounders,props.endpointDates,metricThresholds]);
      
    useEffect(function makePlots(){
        if(metricData !== undefined & metricData !== null){
            let components = (
                <ClusterMetricsD3
                    doseData={props.doseData}
                    clusterData={props.clusterData}
                    metricData={metricData}
                    plotVar={props.plotVar}
                    clusterOrgans={props.clusterOrgans}
                    activeCluster={props.activeCluster}
                    setActiveCluster={props.setActiveCluster}
                    mainSymptom={props.mainSymptom}
                    thresholds={metricThresholds}
                    categoricalColors={props.categoricalColors}
                    endpointDates={props.endpointDates}
                ></ClusterMetricsD3>
            )
            setVizComponents(components);
        } else{
            setVizComponents(<Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>)
        }
    },[metricData,props.mainSymptom,props.endpointDates,props.activeCluster])

    return ( 
        <div ref={ref} id={'doseClusterContainer'}>
            <Container md={12} className = {'noGutter fillWidth'} style={{'height':'45vh'}}>
                    {vizComponents}                
            </Container>
        </div> 
        )
}
