import React, {useRef, useState, useEffect, Fragment} from 'react';
import './TimelineView.css';
import TimelineViewD3 from './TimelineViewD3.js';
import TimelineAxisD3 from './TimelineAxisD3';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

export default function TimelineView(props){
    const timelineRef = useRef(null);
    const [timelineData, setTimelineData] = useState({});
    const [timelineComponents, setTimelineComponents] = useState((<div key={0}></div>));
    const [timelineAxis, setTimelineAxis] = useState((<div></div>));
    const [filterTweets, setFilterTweets] = useState(true);

    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);

    // const [maxRtAgainst, setMaxRtAgainst] = useState(0);
    // const [maxRtFor, setMaxRtFor] = useState(0);

    //use this is I want to do a transform on the retweet count?
    const rtTransform = rts => rts;
    const fetchTimelineData = async () => {
        const res = await props.api.getTimelineData(props.timelineWindowLength);
        setTimelineData(res);
    }

    const makeButtonText = (text,variant='') => {
        return(
            <Button  
                className={'titleButton'} 
                variant={variant}
            >{text}</Button>
        )
    }

    const makeButton = function(text, active){
        let variant = active? 'secondary': 'outline-secondary';
        let onClick = () => {
            if(active){ return; }
            setFilterTweets(!filterTweets);
        }
        let cName = 'titleButton titleText';
        if(active){ cName += ' activeButton'; }
        return(
            <Button  
                className={cName} 
                variant={variant}
                onClick={onClick}
            >{text}</Button>
        )
    }

    useEffect(() => {
        fetchTimelineData();
    },[props.timeLineWindowLength])

    useEffect(() => {
        if(timelineRef.current){
            let h = timelineRef.current.offsetHeight;
            let w = timelineRef.current.offsetWidth;
            setHeight(h);
            setWidth(w);
        }
    })

    useEffect(function drawTimeline(){
        if(width <= 0){return;}
        //weird way of figuring out the legend width.  I just cut this short so I can calculate where to stop the canvas
        let legendWidth = 120;
        if(legendWidth > .4*width){
            legendWidth = .4*width;
        }
        var newTimeAxis = (
            <TimelineAxisD3
                data={timelineData}
                appProps={props}
                legendWidth = {legendWidth}
            ></TimelineAxisD3>
        )

        var makeTimeline = function(onlyActiveFrame){
            return (
            <Fragment key={0}>
                <Row md={12} className={'noGutter timelineContainer'} fluid={'true'}>
                    <TimelineViewD3
                        data={timelineData}
                        activeOnly={onlyActiveFrame}
                        selectedFrame={props.selectedFrame}
                        setBrushedCountyGeoid={props.setBrushedCountyGeoid}
                        brushedCountyGeoid={props.brushedCountyGeoid}
                        appProps={props}
                        rtTransform={rtTransform}
                        legendWidth={legendWidth}
                    ></TimelineViewD3>
                </Row>
            </Fragment>
            )
        }

        var newTimeline = [makeTimeline(filterTweets)]
        
        setTimelineComponents(newTimeline);
        setTimelineAxis(newTimeAxis);
    },
    [timelineData, filterTweets, props.selectedFrame, width, props.brushedCountyGeoid])

    

    return (
    <Container  className={'vizComponent'}  fluid={'true'} ref={timelineRef}>
        <Row className={'noGutter centerText'} style={{'height': '2em'}} fluid={'true'} md={12}>
            {makeButton('All Tweets', !filterTweets)}
            {makeButton('Tweets With ' + props.selectedFrame, filterTweets)}
            {makeButtonText('vs Time')}
        </Row>
        <Row md={12} className={'noGutter'} id={'timelineListContainer'}>
            {timelineComponents}
            <Row md={12} className={'noGutter'} id={'timelineAxisContainer'}>{timelineAxis}</Row>
        </Row>

    </Container>
    )
}