import React, {useState, useEffect} from 'react';

import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

export default function ClusterControlPanel(props){

    const plotVarOptions = constants.DVH_KEYS.slice();
    const nClusterOptions = [2,3,4,5,6,7,8];
    const [featureButtons,setFeatureButtons] = useState(<></>);
    const [nClustButtonOptions, setNClustButtonOptions] = useState(<Dropdown.Item value={0}>{0}</Dropdown.Item>);
    const [tempClusterFeatures,setTempClusterFeatures] = useState();
    const [tempNClusters, setTempNClusters] = useState(1);
    const [plotVarButton, setPlotVarButton] = useState(<></>)
    const removeKey = 'None'


    useEffect(()=>{
        let features = [];
        for(let f of props.clusterFeatures){ features.push(f);}
        setTempClusterFeatures(features);
    },[props.clusterFeatures])

    useEffect(()=>{
        if(props.nDoseClusters !== tempNClusters){
            setTempNClusters(parseInt(props.nDoseClusters))
        }
    },[props.nDoseClusters])

    function handleChangeClusterFeatures(d,e){
        if(tempClusterFeatures.indexOf(d) >= 0){ return; }
        let parentValue = e.target.parentElement.parentElement.getAttribute('value');
        let newFeatureList = [];
        for(let f of props.clusterFeatures){
            if(f !== parentValue){ newFeatureList.push(f); }
        }
        if(d !== removeKey){ newFeatureList.push(d); }
        setTempClusterFeatures(newFeatureList)
        // console.log('change',d,parentValue,props.clusterFeatures.indexOf(parentValue))
    }

    function handleChangeNClusters(d,e){
        let val = parseInt(d);
        if(tempNClusters !== val){
            setTempNClusters(val);
        }
    }

    function handleChangePlotVar(d,e){
        console.log('pvar',d,d!==props.plotVar)
        if(props.plotVar !== d){
            props.setPlotVar(d);
        }
    }

    function handleUpdateClusters(){
        //this may be buggy if react changes the api to make it not batch update
        //since it would trigger a cluster api call half way through,
        //in case this is a future issue.
        //also tis doesnt work if one of these becomes asynce for some reason
        if(tempClusterFeatures !== undefined & tempClusterFeatures.length > 0){
            let tempF = tempClusterFeatures.slice();
            props.setClusterFeatures(tempF)
        }
        if(tempNClusters !== undefined & tempNClusters > 1){
            let tempN = parseInt(tempNClusters);
            props.setNDoseClusters(tempN)
        }
        props.updateClusterOrgans();
    }

    useEffect(function showClusterFeatures(){
        if(tempClusterFeatures === undefined){ return; }
        let features = tempClusterFeatures.slice();
        features.sort();
        features.push('+')
        let optionValues = [removeKey];
        for(let x of plotVarOptions){ optionValues.push(x); }
        let newOptions = optionValues.filter(x=> features.indexOf(x) < 0)
            .map((d,i)=>{
                return (
                    <Dropdown.Item
                        key={i}
                        value={d}
                        eventKey={d}
                        onClick={(e)=>handleChangeClusterFeatures(d,e)}
                    >{d}</Dropdown.Item>
                )
            })
        let fButtons = features.map((f,i)=>{
            return (
                <DropdownButton
                    className={'controlDropdownButton'}
                    title={f}
                    value={f}
                    key={f+i}
                    ifx={i}
                    variant={'primary'}
                >
                    {newOptions}
                </DropdownButton>
            )
        })
        setFeatureButtons(fButtons)
    },[tempClusterFeatures])

    useEffect(function showNClusterDropDown(){
        let nclustOptions = nClusterOptions.map((d,i)=>{
            return (
                <Dropdown.Item
                    key={i}
                    value={d}
                    eventKey={d}
                    onClick={()=>handleChangeNClusters(d)}
                >{d}</Dropdown.Item>
            )
        })
        setNClustButtonOptions(nclustOptions)
    },[tempNClusters])

    useEffect(function plotVarDropDown(){
        let pVarOptions = plotVarOptions.map((d,i)=>{
            return (
                <Dropdown.Item
                    key={i}
                    value={d}
                    eventKey={d}
                    onClick={(e)=>handleChangePlotVar(d,e)}
                >{d}</Dropdown.Item>
            )
        })
        setPlotVarButton(
            <DropdownButton
                className={'controlDropdownButton'}
                value={props.plotVar}
                title={''+props.plotVar}
            >{pVarOptions}</DropdownButton>
        )
    },[props.plotVar])

    const disabled = props.clusterDataLoading;
    return (
        <Container className={'clusterControlPanel noGutter'} fluid={'true'} md={12}>
            <Row md={12} className={'inline'} fluid={'true'}>
                <Col className={'controlPanelTitle'} md={12}>
                    {'Cluster Dose Features'}
                </Col>
                <Col md={12}>
                {featureButtons}
                </Col>
                
            </Row>
            <Row style={{'marginTop': '2em'}} className={'controlPanelTitle'} md={12}>
                <Col md={12}>
                    {'# of Clusters:'}
                    <DropdownButton
                        className={'controlDropdownButton'}
                        value={(tempNClusters!==undefined)? tempNClusters+'':props.nDoseClusters+""}
                        title={(tempNClusters!==undefined)? tempNClusters+'':props.nDoseClusters+""}
                    >
                        {nClustButtonOptions}
                    </DropdownButton>
                </Col>
                <Col md={12}>
                    {'PlotVar:'}
                    {plotVarButton}
                </Col>
            </Row>
            <Row style={{'marginTop': '2em'}} className={'controlPanelTitle'} md={12}>
                <Button
                    onClick={handleUpdateClusters}
                    disabled={disabled}
                    variant={!disabled? "outline-secondary":'dark'}
                >
                    {'Run Clustering'}
                </Button>
            </Row>
        </Container>
    )
}