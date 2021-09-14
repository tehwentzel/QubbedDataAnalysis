import React, {useState, useEffect} from 'react';

import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

export default function NavBar(props){

    console.log('navbar',props);
    const [patientOptions,setPatientOptions] = useState(<></>);

    const handleSelectPatient = (pid) => {
        if(pid !== props.selectedPatient){
            props.setSelectedPatient(pid);
        }
    }

    useEffect(() => {
        let pids = props.patientIds
        if(pids){
            let opt = pids.map((d,i) => {
                return(
                    <Dropdown.Item key={i} value={d} eventKey={d}
                        onClick={(e) => handleSelectPatient(d)}
                    >{d}</Dropdown.Item>
                )
            })
            setPatientOptions(opt)
        }
    },[props.patientIds])

    return (
        <Row className={'noGutter centerText'} fluid={'true'} md={12}>
            <DropdownButton className={'dropDownButton'} 
            variant={'primary'}  
            title={'Patient ' + props.selectedPatient}
            >
                {patientOptions}
            </DropdownButton>
        </Row>
    )
}