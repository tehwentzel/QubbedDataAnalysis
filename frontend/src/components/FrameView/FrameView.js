import React, {useState, useEffect} from 'react';
import Utils from '../../modules/Utils.js';
import './FrameView.css';
import FrameViewD3 from './FrameViewD3.js';
import FrameViewLabelsD3 from './FrameViewLabelsD3.js';
import FrameViewLegendD3 from './FrameViewLegendD3.js';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

export default function FrameView(props){

    const [frameData, setFrameData] = useState({});
    const [sortVariable, setSortVariable] = useState('againstSah');
    const [legendPosition, setLegendPosition] = useState();//object I'll used to make the legend positions?
    const [frameList, setFrameList] = useState(<div/>);

    const fetchFrameData = async () => {
        const res = await props.api.getFrameViewData();
        setFrameData(res);
    }

    useEffect(() => {
        fetchFrameData()
    },[]);

    useEffect(function drawFrame(){
        if(frameData){
            var wTransform = x=>(x**.5);
            var [maxRTFor,maxRTAgainst] = getMaxRTValue(frameData,wTransform);
            let makeFrameEntry = ([fName, fDict],i) => {
                //set up the selection button
                var isActive = (props.selectedFrame === fName);
                var buttonVariant = isActive? 'secondary':'outline-secondary';
                var buttonClass = isActive? 'activeButton frameButton':'frameButton';
                var setFrame = (e) => {
                    props.setSelectedFrame(fName);
                }
                return (
                    <Row key={fName} className={'frameEntry'} sm={12}>
                        <Col className={'noGutter'} sm={2}>
                            <Button 
                                variant={buttonVariant}
                                onClick={setFrame}
                                value={fName}
                                className={buttonClass}
                                block
                            >
                                {fName}  
                            </Button>
                        </Col>
                        <Col sm={10}>
                            <FrameViewD3 
                                data={fDict} 
                                setSortVariable={setSortVariable}
                                appProps={props}
                                maxRTFor={maxRTFor}
                                maxRTAgainst={maxRTAgainst}
                                wTransform={wTransform}
                                position={i}
                                setLegendPosition={setLegendPosition}
                            />
                        </Col>
                    </Row>
                )
            }
            var sortedEntries = sortFrames(frameData, sortVariable)
            var newFrameList = sortedEntries.map((f,d) => makeFrameEntry(f,d));
            setFrameList(newFrameList)
        }
    },[frameData, props.selectedFrame, sortVariable]);


    return (
        <Container fluid={'true'}>
            <Row className={'chartTitle noGutter'} md={12}>
                <p>Moral Frame Summary</p>
            </Row>
            <Row md={12}>
                <Col className={'fillSpace'} md={9}>
                    <Row className={'frameLabels'} sm={12}>
                        <Col className={'noGutter'} sm={2}>
                            <Button
                                variant={''}
                                block
                            >Frames</Button>
                        </Col>
                        <Col sm={10}>
                            <FrameViewLabelsD3
                                lData ={legendPosition}
                                setSortVariable={setSortVariable}
                                sortVariable={sortVariable}
                            ></FrameViewLabelsD3>
                        </Col>
                    </Row>
                    {frameList}
                </Col>
                <Col className={'frameLegend noGutter'} md={3}>
                    <FrameViewLegendD3
                        appProps={props}
                        lData={legendPosition}
                    ></FrameViewLegendD3>
                </Col>
            </Row>
        </Container>
    )
}

function sortFrames(fData, sortVar){
    let accessor = getAccessor(sortVar);

    let valArray = []
    for(const [frame,fdata] of Object.entries(fData)){
        let entry = [frame, fdata];
        valArray.push(entry)
    }
    valArray.sort((a,b) => accessor(b[1]) - accessor(a[1]));
    return valArray
}

function getAccessor(sortVar){
    var accessor;
    switch(sortVar){
        case 'tweetSentiment':
            accessor = x => (x.positive_sentiment-x.negative_sentiment)/x.total_tweets;
            break;
        case 'qualityRatio':
            accessor = x => x.vivid/x.total_tweets;
            break;
        case 'tweetFrameVote':
            accessor = x => x.is_blue/x.total_tweets;
            break;
        case 'forSah':
            accessor = x => x.for_sah;
            break;
        case 'againstSah':
            accessor = x => x.total_tweets - x.for_sah;
            break;
        default:
            accessor = x => x.total_tweets;
    }
    return accessor;
}

function getMaxRTValue(fData,transform){
    var maxFor = 0;
    var maxAgainst = 0;
    for(const [frame, d] of Object.entries(fData)){
        let forSah = d.for_sah_rt_quantiles.map(transform);
        let againstSah = d.against_sah_rt_quantiles.map(transform);
        let totalFor = Utils.sum(forSah);
        let totalAgainst = Utils.sum(againstSah);

        if(totalFor > maxFor){
            maxFor = totalFor;
        }
        if(totalAgainst > maxAgainst){
            maxAgainst = totalAgainst
        }
    }
    return [maxFor, maxAgainst]
}