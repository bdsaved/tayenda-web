import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function Logo({ className, ...props }: LogoProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <path
                d="M19.492 0C13.678 0 8.948 4.782 8.948 10.661V20.516H14.53V10.661C14.53 7.894 16.756 5.643 19.492 5.643H23.584V0H19.492Z"
                fill="#058B48"
            />
            <path
                d="M7.918 0H0V5.643H7.918V0Z"
                fill="#D6DE23"
            />
        </svg>
    );
}
