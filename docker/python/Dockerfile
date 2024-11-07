FROM python:3.12.7-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN pip install --upgrade pip
# RUN pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
RUN echo "test"
COPY requirements.txt /tmp/
RUN pip install -r /tmp/requirements.txt

WORKDIR /usr/src/app

EXPOSE 8888

CMD ["jupyter", "notebook", "--ip='*'","--port=8888", "--no-browser", "--allow-root","--NotebookApp.token=''","--NotebookApp.password=''"]