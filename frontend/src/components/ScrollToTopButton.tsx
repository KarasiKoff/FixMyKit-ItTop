import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import upCircleUrl from '../icon/up-circle.svg';

const SCROLL_THRESHOLD = 200;

export function ScrollToTopButton() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        function onScroll() {
            setVisible(window.scrollY > SCROLL_THRESHOLD);
        }
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    if (!visible) {
        return null;
    }

    return createPortal(
        <button
            type="button"
            className="scroll-to-top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Наверх"
        >
            <img src={upCircleUrl} alt="" width={40} height={40} decoding="async" />
        </button>,
        document.body,
    );
}
