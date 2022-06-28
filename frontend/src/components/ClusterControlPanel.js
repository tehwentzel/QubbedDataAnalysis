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
    const clusterTypeOptions = ['bgmm','gmm','kmeans','ward','spectral',];
    const lrtConfounderOptions = [
        't4','n3',
        'BOT','Tonsil',
        't3','n2',
        't_severe','n_severe',
        'hpv',
        'total_mean_dose',
        'Parotid_Gland_limit',
        'IPC_limit','MPC_limit','SPC_limit',
        'Larynx_limit',
        'age','age_65',
        'IMRT','VMAT','IMPRT',
        'performance_1','performance_2','performance_high',
    ]

    const [featureButtons,setFeatureButtons] = useState(<></>);
    const [confounderButtons, setConfounderButtons] = useState(<></>)
    const [symptomsButtons,setSymptomButtons] = useState(<></>);
    const [nClustButtonOptions, setNClustButtonOptions] = useState(<Dropdown.Item value={0}>{0}</Dropdown.Item>);
    const [tempClusterFeatures,setTempClusterFeatures] = useState();
    const [tempNClusters, setTempNClusters] = useState(1);
    const [tempConfounders,setTempConfounders] = useState();
    const [tempClusterType,setTempClusterType] = useState();
    const [tempSOIs,setTempSOIs] = useState();
    const [plotVarButton, setPlotVarButton] = useState(<></>);
    const removeKey = 'None'


    useEffect(()=>{
        let features = [];
        for(let f of props.clusterFeatures){ features.push(f);}
        setTempClusterFeatures(features);
    },[props.clusterFeatures])

    useEffect(()=>{
        let confs = [];
        for(let f of props.lrtConfounders){ confs.push(f);}
        setTempConfounders(confs);
    },[props.lrtConfounders])

    useEffect(()=>{
        if(props.nDoseClusters !== tempNClusters){
            setTempNClusters(parseInt(props.nDoseClusters))
        }
    },[props.nDoseClusters])

    useEffect(() => {
        if(props.symptomsOfInterest !== tempSOIs){
            setTempSOIs(props.symptomsOfInterest);
        }
    },[props.symptomsOfInterest])

    
    function handleChangeNClusters(d,e){
        let val = parseInt(d);
        if(tempNClusters !== val){
            setTempNClusters(val);
        }
    }

    function handleChangePlotVar(d,e){
        if(props.plotVar !== d){
            props.setPlotVar(d);
        }
    }

    function handleUpdateClusters(){
        //this may be buggy if react changes the api to make it not batch update
        //since it would trigger a cluster api call half way through,
        //in case this is a future issue.
        //also tis doesnt work if one of these becomes asynce for some reason
        props.setClusterDataLoading(true);
        if(tempClusterFeatures !== undefined & tempClusterFeatures.length > 0){
            let tempF = tempClusterFeatures.slice();
            props.setClusterFeatures(tempF)
        }
        if(tempNClusters !== undefined & tempNClusters > 1){
            let tempN = parseInt(tempNClusters);
            props.setNDoseClusters(tempN)
        }
        if(tempClusterType !== undefined & tempClusterType !== props.clusterType){
            let tempType = tempClusterType + '';
            props.setClusterType(tempType);
        }
        if(tempConfounders !== undefined & tempConfounders !== props.lrtConfounder){
            let tempConf = tempConfounders.slice();
            props.setLrtConfounders(tempConf);
        }
        if(tempSOIs !== undefined & tempSOIs.length > 0){
            let tempSymptoms = tempSOIs.slice();
            props.setSymptomsOfInterest(tempSymptoms);
        }
        props.updateClusterOrgans();
    }

    function makeDropdownListUpdater(tempVals,setTempVals){
        var handleChangeFeature = (d,e) => {
            if(tempVals.indexOf(d) >= 0){return;}
            let parentValue = e.target.parentElement.parentElement.getAttribute('value');
            let newValList = [];
            for(let f of tempVals){
                if(f !== parentValue){ newValList.push(f); }
            }
            if(d !== removeKey){ newValList.push(d); }
            setTempVals(newValList)
        }
        return handleChangeFeature
    }

    function makeDropDownList(featureList,options,setTempFeatures){
        if(featureList === undefined){ return (<></>)}
        var features = featureList.slice();
        features.sort();
        features.push('+')
        let optionValues = [removeKey];
        for(let x of options){ optionValues.push(x); }
        const onclick =makeDropdownListUpdater(featureList,setTempFeatures);
        let newOptions = optionValues.filter(x=> features.indexOf(x) < 0)
            .map((d,i)=>{
                return (
                    <Dropdown.Item
                        key={i}
                        value={d}
                        eventKey={d}
                        onClick={(e)=>onclick(d,e)}
                    >{d}</Dropdown.Item>
                )
            })
        let fButtons = features.map((f,i)=>{
            return (
                <DropdownButton
                    className={'controlDropdownButton compactButton'}
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
        return fButtons
    }

    useEffect(function showClusterFeatures(){
        if(tempClusterFeatures === undefined){ return; }
        let fb = makeDropDownList(tempClusterFeatures,plotVarOptions,setTempClusterFeatures)//,handleChangeClusterFeatures)
        setFeatureButtons(fb)
    },[tempClusterFeatures]);

    useEffect(function showConfounders(){
        if(tempConfounders === undefined){ return; }
        let cb = makeDropDownList(tempConfounders,lrtConfounderOptions,setTempConfounders)//handleChangeLrtConfounders);
        setConfounderButtons(cb);
    },[tempConfounders]);

    useEffect(function showSymptoms(){
        if(tempSOIs === undefined){ return; }
        let sb = makeDropDownList(tempSOIs,props.allSymptoms,setTempSOIs)//handleChangeSOIs);
        setSymptomButtons(sb);
    },[tempSOIs,props.allSymptoms])

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

    const clusterTypeButtonOptions = clusterTypeOptions.map((d,i)=>{
        return(
            <Dropdown.Item
                key={i}
                value={d}
                eventKey={d}
                onClick={(e)=>setTempClusterType(d)}
            >{d}</Dropdown.Item>
        )
    });


    const clusterButtonTitle = (tempClusterType === undefined)? props.clusterType: tempClusterType;
    const onToggleShowContra = () => {
        props.setShowContralateral(!props.showContralateral);
    }
    const disabled = props.clusterDataLoading;
    return (
        <Container className={'clusterControlPanel noGutter'} fluid={'true'} md={12}>
            <Row md={12} className={'inline controlPanelTitle'} fluid={'true'}>
                <Col md={12}>
                {'Cluster Dose Features: '}
                {featureButtons}
                </Col>
                <Col md={12}>
                {'LRT Test Confounders: '}
                    {confounderButtons}
                </Col>
                <Col md={12}>
                {'Symptoms: '}
                    {symptomsButtons}
                </Col>
            </Row>
            <Row className={'noGutter controlPanelTitle'} md={12}>
                <Col md={3}>
                    {'# Clusters:'}
                    <DropdownButton
                        className={'controlDropdownButton'}
                        value={(tempNClusters!==undefined)? tempNClusters+'':props.nDoseClusters+""}
                        title={(tempNClusters!==undefined)? tempNClusters+'':props.nDoseClusters+""}
                    >
                        {nClustButtonOptions}
                    </DropdownButton>
                </Col>
                <Col md={3}>
                    {'Method:'}
                    <DropdownButton
                        className={'controlDropdownButton'}
                        value={clusterButtonTitle}
                        title={clusterButtonTitle}
                    >
                        {clusterTypeButtonOptions}
                    </DropdownButton>
                </Col>
                <Col md={3}>
                    {'PlotVar:'}
                    {plotVarButton}
                </Col>
                <Col md={3}>
                    <Button
                        value={props.showContralateral}
                        variant={'outline-secondary'}
                        onClick={onToggleShowContra}
                        disabled={false}
                    >{props.showContralateral? 'Showing Contralateral': 'Hidding Contralateral'}</Button>
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