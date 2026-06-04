import React from 'react';
import { useCategoryIconSrc } from '../../../hooks/useCategoryIconSrc';

export function CategoryRowIcon({ id, hasIcon }: { id: string; hasIcon: boolean }) {
    const src = useCategoryIconSrc(id, hasIcon);
    return <img src={src} alt="" className="category-name-cell__icon" draggable={false} />;
}
