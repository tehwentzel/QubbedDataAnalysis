import React, {useState, useEffect} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from '../modules/Constants.js';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

export default function MapControlPanel(props){

    const mapInputs = constants.MAP_FEATURES;
    const [mapDropDownOptions, setMapDropDownOptions] = useState(['']);

    function handleSelectMapVar(varName){
        if(props.mapVar != varName){
            props.setMapVar(varName);
        }
    }


    useEffect(function setMapDropDown(){
        let optionsList = [...mapInputs];
        let opt = optionsList.map((d,idx) => {
            return(
                <Dropdown.Item key={idx} value={d} eventKey={d} onClick={(e) => handleSelectMapVar(d)}>{Utils.getVarDisplayName(d)}</Dropdown.Item> 
            )
        });

        setMapDropDownOptions(opt);
    },[props.mapVar,props.selectedFrame])

    //the rest of the text is a button with an empty variant because thats the easiest way to get
    //the formatting to work
    const makeButtonText = (text,variant='') => {
        return(
            <Button  
                className={'mapDropdownButton titleButton'} 
                variant={variant}
            >{text}</Button>
        )
    }

    return (
    <Row className={'noGutter centerText'} fluid={'true'} md={12}>
            {makeButtonText('Color Stripes: ')}
            <DropdownButton className={'mapDropdownButton'} variant={'primary'}  title={Utils.getVarDisplayName(props.mapVar)}>
                {mapDropDownOptions}
            </DropdownButton>
            {makeButtonText('  |  Black Stripes: ')}
            <Button className={'mapDropdownButton'} variant={'secondary'}>{props.selectedFrame}</Button>
    </Row>
    )
}
