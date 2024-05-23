import React from 'react';
import Typed from 'typed.js';
import styles from '../styles/home.module.css';
import TechStack from './TechStack';

export default function Home() {
    // Create reference to store the DOM element containing the animation
    const el = React.useRef(null);
    React.useEffect(() => {
        const typed = new Typed(el.current, {
            strings: ['Software Developer', 'AI Enginner', 'Aspiring Entreprenur'],
            // strings: ['Software Developer'], 
            typeSpeed: 80,
            backSpeed: 10,
            startDelay: 1000,
            loop: false,
        });
        return () => {
            // Destroy Typed instance during cleanup to stop animation
            typed.destroy();
        };
    }, []);

    return (
        <div>
            <div className={styles.aboutMe}>
                <div className={styles.content}>
                    <div className={styles.intro}>
                        <h1>Hi! I'm </h1>
                        <h1 className={styles.name}>ASH (Asahi)</h1>
                    </div>
                    <h1>I am a ... </h1>
                    <span className={styles.title} ref={el} />
                    <p className={styles.description}>
                        Ex. “I'm a full stack developer specializing in building (and occasionally designing) exceptional digital experiences. 
                        Currently I'm focused on building back-end applications.”
                    </p>
                    <div className={styles.projectContainer}>
                        <h2 className={styles.project}><a href="">PROJECTS</a></h2>
                    </div>
                </div>
                <div className={styles.imageContainer}>
                </div>
            </div>
        </div>
    );
}