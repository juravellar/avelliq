export const PageContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 sm:p-6">{children}</div>;
};

export const PageHeader = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">{children}</div>;
};

export const PageHeaderContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <div className="w-full min-w-0 space-y-1">{children}</div>;
};

export const PageTitle = ({ children }: { children: React.ReactNode }) => {
  return <h1 className="text-2xl font-bold">{children}</h1>;
};

export const PageDescription = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <p className="text-muted-foreground text-sm">{children}</p>;
};

export const PageActions = ({ children }: { children: React.ReactNode }) => {
  // Keeps its width beside the title, which takes the rest of the row.
  return (
    <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
      {children}
    </div>
  );
};

export const PageContent = ({ children }: { children: React.ReactNode }) => {
  return <div className="space-y-6">{children}</div>;
};

export const PageFooter = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex items-center justify-end">{children}</div>;
};