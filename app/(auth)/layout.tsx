interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-svh bg-muted p-6 md:p-10">
            <div className="w-full max-w-sm md:max-w-3xl">
                {children}
            </div>
        </div>
    ) 
}

export default Layout   ;