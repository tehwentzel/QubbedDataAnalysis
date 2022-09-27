import React, {useState, useEffect, useRef, Fragment} from 'react';
// import Utils from '../modules/Utils.js';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
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
    const thresholdOptions = [-7,-5,-3,-1,0,3,5,7];

    var fetchMetrics = async(cData,dates,lrtConfounders,thresholds,symptoms)=>{
        if(cData !== undefined & !props.clusterDataLoading){
            setMetricData(undefined);
            props.api.getLRTests(cData,dates,lrtConfounders,thresholds,symptoms).then(response =>{
            console.log('cluster metric data',response)
            setMetricData(response);
          }).catch(error=>{
            console.log('cluster metric data error',error);
          })
        }  
      }

    function toggleThreshold(t){
        t = parseInt(t);
        if(metricThresholds.indexOf(t) < 0){
            let newList = metricThresholds.map(x=>x);
            newList.push(t);
            newList.sort();
            setMetricThresholds(newList)
        } else{
            let newList = metricThresholds.filter(x=> x !== t);
            newList.sort();
            setMetricThresholds(newList);
        }
    }

    function formatTButton(t){
        if(t === -1){
            return 'Δlinear';
        } else if(t === 0){
            return 'linear'
        }
        let string = Math.abs(t) + '';
        if( t < 0){
            string = 'Δ' + string;
        }
        return string;
    }
    const makeThresholdButtons = () => {
        let buttons = thresholdOptions.map((t) => {
            let active = (metricThresholds.indexOf(t) >= 0);
            return (
                <Button
                    variant={active? 'secondary':'outline-secondary'}
                    onClick={()=>toggleThreshold(t)}
                    disabled={active & (metricThresholds.length <= 1)}
                >{formatTButton(t)}</Button>
            )
        })
        return buttons;
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
            <Row md={12} className = {'noGutter fillWidth'} style={{'height':'45vh'}}>
                <Col md={10} className={'noGutter'}>
                    {vizComponents}     
                </Col>
                <Col md={2} className={'noGutter'}>
                    <Button
                        style={{'width': '100%'}}
                        variant={'light'}
                    >{'Outcomes'}</Button>
                    <span >
                        {makeThresholdButtons()}
                    </span>
                    
                </Col>
            </Row>
        </div> 
        )
}
