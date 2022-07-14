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
import RuleViewD3 from './RuleViewD3.js';

export default function RuleView(props){
    const ref = useRef(null)

    //data for query looking at boolean splits in the 'rule' view
    const [ruleData,setRuleData] = useState(undefined);
    //threshold for symptoms to use as the target class
    const [ruleThreshold,setRuleThreshold] = useState(5);
    //the cluster we should use for the rule mining when predicing symptoms.  default undefined means using the whole cohort
    const [ruleCluster,setRuleCluster] = useState();
    //the max # of splits to allow
    const [ruleMaxDepth,setRuleMaxDepth] = useState(2);
    //used to filter out the best rules at each depth
    const [maxRules,setMaxRules] = useState(3);
    //what to use to determine optimal splits. currently 'info' or 'odds ratio'
    const [ruleCriteria,setRuleCriteria] = useState('info');
    //if > 0 and not undefined, we predict membership in a cluster instead of outcomes
    const [ruleTargetCluster,setRuleTargetCluster] = useState(props.activeCluster)
    const [ruleUseAllOrgans,setRuleUseAllOrgans] = useState(false);
    const [ruleMinInfo,setRuleMinInfo] = useState(.8);

    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    var fetchClusterRules = async(cData,organs,
        symptoms,clusterFeatures,
        threshold,cluster,
        maxDepth,maxR,rCriteria,
        targetCluster,mInfo,
        )=>{
        if(cData !== undefined & !props.clusterDataLoading){
            setRuleData(undefined);
            props.api.getClusterRules(cData,organs,
                symptoms,clusterFeatures,
                threshold,cluster,
                maxDepth,maxR,
                rCriteria,targetCluster,
                mInfo,
            ).then(response=>{
                // console.log('rule data main',response);
                setRuleData(response);
            }).catch(error=>{
            console.log('rule data error',error);
            })
        }
    }

    useEffect(function updateRuleTargetCluster(){
        if(ruleTargetCluster >= 0 & ruleTargetCluster !== props.activeCluster){
          setRuleTargetCluster(props.activeCluster);
        }
      },[props.activeCluster])
    
    useEffect(function updateRuleCluster(){
        if(ruleCluster !== null & ruleCluster !== undefined & ruleCluster !== props.activeCluster){
            setRuleCluster(props.activeCluster);
        }
    },[props.activeCluster]);
    
    
    useEffect(function updateRules(){
        if(props.clusterData !== undefined & props.clusterData !== null & !props.clusterDataLoading){
            let rOrgans = [...props.clusterOrgans];
            if(ruleUseAllOrgans){
                rOrgans = [...constants.ORGANS_TO_SHOW];
            }
            fetchClusterRules(
                props.clusterData,
                rOrgans,
                [props.mainSymptom],
                props.clusterFeatures,
                ruleThreshold,
                ruleCluster,
                ruleMaxDepth,
                maxRules,
                ruleCriteria,
                ruleTargetCluster,
                ruleMinInfo,
            );
        
        }
    },[
        props.clusterData,props.mainSymptom,
        ruleThreshold,ruleCluster,
        props.clusterDataLoading,
        ruleMaxDepth,maxRules,
        ruleCriteria,ruleTargetCluster,
        ruleUseAllOrgans,ruleMinInfo,
    ])

    const filterCluster = parseInt(ruleCluster) === parseInt(props.activeCluster)
    const parseString = v => v+'';

    function makeRow(rule,key){
        const fix = val => {
            if(val === undefined | val === null){
                return 'N/A';
            } else{
                return val.toFixed(3)
            }
        }
        
        let title = 'OR: ' + fix(rule.odds_ratio) 
            + ' |Info Gain: ' + fix(rule.info)   
            // + ' |ROC:' + fix(rule.roc_auc)
            // + ' |F1:' + fix(rule.f1) 
            + ' |Prsn:' + fix(rule.precision) 
            + ' |Rcl:' + fix(rule.recall);
        // if (ruleTargetCluster >= 0){
            title += ' |Outcome ROC:' + fix(rule.roc_auc_symptom) 
            + ' |Outcome F1:' + fix(rule.f1_symptom);
        // }

        // title += '' 
        // for(let i in rule.features){
        //     title += ' | '+ rule.features[i] + '>' + rule.thresholds[i];
        // }

        const keyName = key + props.mainSymptom
            + parseString(ruleCluster)+parseString(ruleThreshold)
            +parseString(ruleTargetCluster)+parseString(ruleUseAllOrgans)
            +parseString(ruleMaxDepth)
        return (
            <Row 
                key={keyName} 
                style={{'display':'inline-block','width':'50%','height': '20em','marginBottom':'1em'}}
            >
                <span  style={{'fontSize':'.7em'}}>
                {title}
                </span>
                <Row  
                    className={'noGutter fillWidth'} 
                    style={{'height': '18em'}}
                >
                    <RuleViewD3
                        rule={rule}
                        doseData={props.doseData}
                        ruleData={ruleData}
                        svgPaths={props.svgPaths}
                        mainSymptom={props.mainSymptom}
                        clusterData={props.clusterData}
                        ruleThreshold={ruleThreshold}
                        ruleCluster={ruleCluster}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        ruleTargetCluster={ruleTargetCluster}
                        categoricalColors={props.categoricalColors}
                    ></RuleViewD3>
                </Row>
            </Row>
        )
    }

    function toggleFilter(arg){
        if(!arg){
            setRuleCluster(undefined);
        } else{
            setRuleCluster(parseInt(props.activeCluster));
        }
        setRuleTargetCluster(-1);
    }

    function makeFilterToggle(){
        function onSetTargetCluster(){
            if(ruleTargetCluster !== props.activeCluster){
                setRuleTargetCluster(props.activeCluster);
            }
        }
        const predictClusterActive = (ruleTargetCluster === props.activeCluster);
        return (
            <div className={'center-block'}>
            <Form.Label>{'Prediction'}</Form.Label>
            <InputGroup>
                <Button
                    variant={(!filterCluster & !predictClusterActive)? 'dark':'outline-secondary'}
                    onClick={() => toggleFilter(false)}
                    disabled={!filterCluster & !predictClusterActive}
                >{'cohort->outcome'}</Button>
                <Button
                    variant={(filterCluster & !predictClusterActive)? 'dark':'outline-secondary'}
                    onClick={()=>toggleFilter(true)}
                    disabled={filterCluster & !predictClusterActive}
                >{'clst' + props.activeCluster + '->outcome'}</Button>
                <Button
                    variant={predictClusterActive? 'dark':'outline-secondary'}
                    onClick={onSetTargetCluster}
                    disabled={predictClusterActive}
                >{'cohort->clst ' + props.activeCluster}</Button>
            </InputGroup>
            </div>
        )
    }

    function makeCriteriaToggle(){
        var makeButton = (name)=>{
            let active = (ruleCriteria === name);
            return (
                <Button
                    variant={active? 'dark':'outline-secondary'}
                    onClick={()=>{setRuleCriteria(name)}}
                    disabled={active}
                >{name}</Button>
            )
        }
        return (
            <div className={'center-block'}>
            <Form.Label>{'Criteria'}</Form.Label>
            <InputGroup
            >
                {makeButton('info')}
                {makeButton('odds_ratio')}
            </InputGroup>
            </div>
        )
    }

    function makeOrganSetToggle(){
        var makeButton = (boolState)=>{
            let active = (ruleUseAllOrgans === boolState);
            let name = 'All';
            if(!boolState){
                name = 'Cluster'
            }
            return (
                <Button
                    variant={active? 'dark':'outline-secondary'}
                    onClick={()=>{setRuleUseAllOrgans(boolState)}}
                    disabled={active}
                >{name}</Button>
            )
        }
        return (
            <div className={'center-block'}>
            <Form.Label>{'Organs'}</Form.Label>
            <InputGroup
            >
                {makeButton(true)}
                {makeButton(false)}
            </InputGroup>
            </div>
        )
    }

    function handleChangeThreshold(t){
        t=parseInt(t);
        if(t !== ruleThreshold){
            setRuleThreshold(t);
        }
    }

    function makeThresholdDropDown(){
        const dItems = [3,4,5,6,7,8].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    onClick={e => handleChangeThreshold(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                className={'controlDropdownButton'}
                title={'Threshold ' + ruleThreshold}
            >{dItems}</DropdownButton>
        )
    }

    function makeMaxSplitsDropDown(){
        var handleChangeSplit = (s)=>{
            if(ruleMaxDepth !== s){
                setRuleMaxDepth(s);
            }
        }
        const dItems = [1,2,3,4,5].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    onClick={e => handleChangeSplit(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                className={'controlDropdownButton'}
                title={'Max Splits ' + ruleMaxDepth}
            >{dItems}</DropdownButton>
        )
    }

    function makeMaxRulesDropDown(){
        var handleChangeMaxRules = (s)=>{
            if(maxRules !== s){
                setMaxRules(s);
            }
        }
        const dItems = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    
                    onClick={e => handleChangeMaxRules(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                drop={'up'}
                className={'controlDropdownButton'}
                title={'Max Rules ' + maxRules}
            >{dItems}</DropdownButton>
        )
    }

    function makeMinInfoDropDown(){
        const dItems = [.1,.2,.3,.4,.5,.6,.7,.8,.9,1.0,1.1,1.2,1.3,1.4,1.5].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    onClick={e => {
                        if(ruleMinInfo !== t){
                            setRuleMinInfo(t);
                        }
                    }}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                className={'controlDropdownButton'}
                title={'Min Split Info: ' + ruleMinInfo.toFixed(1)}
            >{dItems}</DropdownButton>
        )
    }

    function makeThresholdForm(){
        let onKey = (e) => {
            if(e.code === 'Enter'){
                let val = e.target.value;
                if(Number.isInteger(val) & parseInt(val) !== ruleThreshold){
                    setRuleThreshold(parseInt(val))
                }
            }
        }
        return (
            <>
                <Form.Label>{'Symptom Threshold'}</Form.Label>
                <InputGroup>
                    <Button
                        onClick={()=>{setRuleThreshold(ruleThreshold-1)}}
                    >{'-'}</Button>
                    <FormControl
                        defaultValue={ruleThreshold}
                        onKeyDown={onKey}
                    />
                    <Button
                        onClick={()=>{setRuleThreshold(ruleThreshold+1)}}
                    >{'+'}</Button>
                </InputGroup>
            </>
        )
    }

    useEffect(function plotStuff(){
        if(ruleData !== undefined & props.doseData !== undefined){

            let entries = ruleData.map((r,i) => makeRow(r,i+'rule'));
            setVizComponents(entries)
        } else{
            setVizComponents(
                <Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>
            )
        }
    },[ruleData,props.doseData,props.selectedPatientId])

    return (
        <div ref={ref} className={'noGutter fillSpace'}>
            <Row md={12} className={'noGutter fillSpace'}>
                <Col md={10} className={'noGutter scroll'} style={{'height':'45vh'}}>
                    {vizComponents}
                </Col>
                <Col md={2} className={'noGutter'}>
                    {makeFilterToggle()}
                    {makeCriteriaToggle()}
                    {makeOrganSetToggle()}
                    {makeThresholdDropDown()}
                    {makeMaxSplitsDropDown()}
                    {makeMinInfoDropDown()}
                    {makeMaxRulesDropDown()}
                    {/* {makeThresholdForm()} */}
                </Col>
            </Row>
        </div>
    )
}

